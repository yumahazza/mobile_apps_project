/* global __dirname */
/**
 * Fritz — Standalone Sprint 3 Test Runner (Push Notification, FCM & Server Triggers)
 *
 * Menguji:
 * 1. Modul TypeScript client `src/tests/fritzSprint3.test.ts` (aturan trigger, isolasi penerima, navigasi)
 * 2. Modul server Firebase Cloud Functions `functions/notificationTriggers.js` dengan mock Firestore & FCM Admin:
 *    - Pembukaan sesi hanya terkirim ke praktikan terdaftar (tidak ke praktikan luar kelas / asisten)
 *    - Perubahan jadwal terkirim ke peserta terdampak
 *    - Keputusan izin (DITERIMA / DITOLAK) hanya terkirim ke praktikan pengaju
 *    - Penanganan user tanpa token FCM, kegagalan pengiriman FCM, dan auto-pruning token invalid
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const ROOT_DIR = path.resolve(__dirname, '../..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

function loadTsModule(filePath) {
  const originalResolve = Module._resolveFilename;
  const originalTsExt = require.extensions['.ts'];

  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request.startsWith('@/')) {
      const candidate = path.join(SRC_DIR, request.slice(2));
      if (fs.existsSync(`${candidate}.ts`)) return `${candidate}.ts`;
      if (fs.existsSync(`${candidate}.tsx`)) return `${candidate}.tsx`;
      return candidate;
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };

  require.extensions['.ts'] = function (mod, filename) {
    const source = fs.readFileSync(filename, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
      fileName: filename,
    });
    mod._compile(transpiled.outputText, filename);
  };

  try {
    return require(filePath);
  } finally {
    Module._resolveFilename = originalResolve;
    if (originalTsExt) {
      require.extensions['.ts'] = originalTsExt;
    } else {
      delete require.extensions['.ts'];
    }
  }
}

function createMockAdminEnv(initialUsers, multicastBehavior) {
  const users = new Map(
    Object.entries(initialUsers).map(([uid, data]) => [
      uid,
      { ...data, fcmTokens: Array.isArray(data.fcmTokens) ? [...data.fcmTokens] : [] },
    ]),
  );
  const notifications = [];
  const multicastCalls = [];
  let notifSeq = 1;

  const fieldValue = {
    serverTimestamp: () => '__SERVER_TIMESTAMP__',
    arrayRemove: (...items) => ({ __arrayRemove: items }),
  };

  const db = {
    collection: (name) => {
      if (name === 'notifications') {
        return {
          doc: () => {
            const id = `notif-${notifSeq++}`;
            return {
              id,
              set: async (data) => {
                notifications.push({ ...data });
              },
            };
          },
        };
      }
      if (name === 'users') {
        return {
          doc: (uid) => ({
            get: async () => ({
              exists: users.has(uid),
              data: () => users.get(uid),
            }),
            update: async (patch) => {
              const existing = users.get(uid);
              if (!existing) throw new Error(`User ${uid} not found`);
              if (patch.fcmTokens && patch.fcmTokens.__arrayRemove) {
                const toRemove = new Set(patch.fcmTokens.__arrayRemove);
                existing.fcmTokens = existing.fcmTokens.filter((t) => !toRemove.has(t));
              }
            },
          }),
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    },
  };

  const messaging = {
    sendEachForMulticast: async (message) => {
      multicastCalls.push(message);
      return multicastBehavior(message);
    },
  };

  return {
    users,
    notifications,
    multicastCalls,
    deps: {
      db,
      messaging,
      fieldValue,
      logger: { info: () => {}, error: () => {} },
    },
  };
}

async function runCloudFunctionDeliveryTests() {
  const triggers = require(path.join(ROOT_DIR, 'functions/notificationTriggers.js'));
  const results = [];

  function assert(name, condition, detail) {
    results.push({ name, success: condition, detail });
    if (!condition) {
      console.error(`❌ FAILED: ${name} - ${detail || ''}`);
    } else {
      console.log(`✅ PASSED: ${name}`);
    }
  }

  // Test A: Pembukaan sesi -> hanya kirim ke praktikan terdaftar; user tanpa token tetap tercatat & tidak crash; token invalid otomatis dibersihkan
  const envA = createMockAdminEnv(
    {
      'stu-1': { role: 'student', fcmTokens: ['tok-stu1-valid', 'tok-stu1-expired'] },
      'stu-2': { role: 'student', fcmTokens: [] }, // izin ditolak / belum punya token
      'stu-outside': { role: 'student', fcmTokens: ['tok-outside'] },
      'ast-1': { role: 'assistant', fcmTokens: ['tok-ast1'] },
    },
    async (msg) => ({
      successCount: msg.tokens.filter((t) => !t.includes('expired')).length,
      failureCount: msg.tokens.filter((t) => t.includes('expired')).length,
      responses: msg.tokens.map((t) =>
        t.includes('expired')
          ? { success: false, error: { code: 'messaging/registration-token-not-registered' } }
          : { success: true },
      ),
    }),
  );

  const openDispatch = triggers.evaluateSessionOpenedTrigger(
    { status: 'BELUM_DIBUKA', courseName: 'Struktur Data', className: 'IF-A', room: 'Lab A', assistantId: 'ast-1', enrolledStudents: ['stu-1', 'stu-2'] },
    { status: 'DIBUKA', courseName: 'Struktur Data', className: 'IF-A', room: 'Lab A', assistantId: 'ast-1', enrolledStudents: ['stu-1', 'stu-2'] },
    'sch-sd-1',
  );
  const summaryA = await triggers.dispatchNotificationsToRecipients(openDispatch, envA.deps);

  assert(
    'Cloud Function SESSION_OPENED menyimpan riwayat hanya untuk stu-1 & stu-2 (bukan stu-outside/ast-1)',
    summaryA.storedCount === 2 &&
      envA.notifications.every((n) => n.recipientUid === 'stu-1' || n.recipientUid === 'stu-2') &&
      envA.notifications.every((n) => n.type === 'SESSION_OPENED' && n.readAt === null),
    JSON.stringify({ summaryA, notifications: envA.notifications }),
  );

  assert(
    'Cloud Function menangani user tanpa token dengan aman (skippedNoTokenCount = 1) & membuang token invalid (prunedTokenCount = 1)',
    summaryA.sentTokenCount === 1 &&
      summaryA.failedTokenCount === 1 &&
      summaryA.skippedNoTokenCount === 1 &&
      summaryA.prunedTokenCount === 1 &&
      envA.users.get('stu-1').fcmTokens.length === 1 &&
      envA.users.get('stu-1').fcmTokens[0] === 'tok-stu1-valid' &&
      envA.multicastCalls.length === 1 &&
      envA.multicastCalls[0].android.notification.channelId === 'practicum_updates',
    JSON.stringify({ summaryA, tokensAfter: envA.users.get('stu-1').fcmTokens }),
  );

  // Test B: Kegagalan pengiriman FCM pada satu penerima tidak menghentikan pengiriman ke penerima lain
  const envB = createMockAdminEnv(
    {
      'stu-1': { role: 'student', fcmTokens: ['tok-fail'] },
      'stu-2': { role: 'student', fcmTokens: ['tok-ok'] },
    },
    async (msg) => {
      if (msg.tokens.includes('tok-fail')) {
        throw new Error('Simulated FCM network outage');
      }
      return { successCount: 1, failureCount: 0, responses: [{ success: true }] };
    },
  );

  const scheduleUpdateDispatch = triggers.evaluateScheduleUpdatedTrigger(
    { courseName: 'Sistem Operasi', className: 'IF-B', room: 'Lab A', date: '2026-11-28', time: '09:00 - 11:00', assistantId: 'ast-1', enrolledStudents: ['stu-1', 'stu-2'] },
    { courseName: 'Sistem Operasi', className: 'IF-B', room: 'Lab B', date: '2026-11-29', time: '09:00 - 11:00', assistantId: 'ast-1', enrolledStudents: ['stu-1', 'stu-2'] },
    'sch-so-1',
  );
  const summaryB = await triggers.dispatchNotificationsToRecipients(scheduleUpdateDispatch, envB.deps);

  assert(
    'Error jaringan FCM pada stu-1 ditangani tanpa menggagalkan pengiriman SCHEDULE_UPDATED ke stu-2',
    summaryB.storedCount === 2 &&
      summaryB.failedTokenCount === 1 &&
      summaryB.sentTokenCount === 1,
    JSON.stringify(summaryB),
  );

  // Test C: Keputusan izin hanya dikirim ke praktikan pengaju (bukan praktikan lain)
  const envC = createMockAdminEnv(
    {
      'stu-1': { role: 'student', fcmTokens: ['tok-stu1'] },
      'stu-2': { role: 'student', fcmTokens: ['tok-stu2'] },
    },
    async () => ({ successCount: 1, failureCount: 0, responses: [{ success: true }] }),
  );

  const leaveDispatch = triggers.evaluateLeaveDecisionTrigger(
    { scheduleId: 'sch-so-1', courseName: 'Sistem Operasi', className: 'IF-B', studentId: 'stu-1', status: 'MENUNGGU' },
    { scheduleId: 'sch-so-1', courseName: 'Sistem Operasi', className: 'IF-B', studentId: 'stu-1', status: 'DITOLAK' },
    'sch-so-1_stu-1',
  );
  const summaryC = await triggers.dispatchNotificationsToRecipients(leaveDispatch, envC.deps);

  assert(
    'Cloud Function LEAVE_REJECTED hanya mengirim notifikasi ke stu-1 dan tidak ke stu-2',
    summaryC.attemptedRecipients === 1 &&
      summaryC.sentTokenCount === 1 &&
      envC.notifications.length === 1 &&
      envC.notifications[0].recipientUid === 'stu-1' &&
      envC.notifications[0].type === 'LEAVE_REJECTED' &&
      envC.multicastCalls.length === 1 &&
      envC.multicastCalls[0].data.recipientUid === 'stu-1',
    JSON.stringify({ summaryC, notifications: envC.notifications }),
  );

  return results;
}

async function runSparkWorkerTests() {
  const { startNotificationWorker } = require(path.join(ROOT_DIR, 'functions/worker.js'));
  const results = [];

  function assert(name, condition, detail) {
    results.push({ name, success: condition, detail });
    if (!condition) {
      console.error(`❌ FAILED: ${name} - ${detail || ''}`);
    } else {
      console.log(`✅ PASSED: ${name}`);
    }
  }

  const listeners = {};
  const baseEnv = createMockAdminEnv(
    {
      'stu-1': { role: 'student', fcmTokens: ['tok-stu1'] },
      'stu-2': { role: 'student', fcmTokens: ['tok-stu2'] },
    },
    async () => ({ successCount: 1, failureCount: 0, responses: [{ success: true }] }),
  );

  const workerDb = {
    collection: (name) => {
      if (name === 'schedules' || name === 'leave_requests') {
        return {
          onSnapshot: (onNext) => {
            listeners[name] = onNext;
            return () => {
              delete listeners[name];
            };
          },
        };
      }
      return baseEnv.deps.db.collection(name);
    },
  };

  const worker = startNotificationWorker({
    ...baseEnv.deps,
    db: workerDb,
  });

  // 1. Snapshot awal TIDAK boleh mengirim spam notifikasi untuk dokumen lama
  await listeners.schedules({
    docs: [
      {
        id: 'sch-1',
        data: () => ({
          courseName: 'Mobile Dev',
          className: 'IF-A',
          room: 'Lab A',
          date: '2026-11-25',
          time: '08:00 - 10:00',
          status: 'BELUM_DIBUKA',
          assistantId: 'ast-1',
          enrolledStudents: ['stu-1'],
        }),
      },
    ],
    docChanges: () => [],
  });

  await listeners.leave_requests({
    docs: [
      {
        id: 'sch-1_stu-1',
        data: () => ({
          scheduleId: 'sch-1',
          courseName: 'Mobile Dev',
          className: 'IF-A',
          studentId: 'stu-1',
          status: 'MENUNGGU',
        }),
      },
    ],
    docChanges: () => [],
  });

  assert(
    'Spark worker tidak mengirim spam notifikasi saat snapshot awal dimuat',
    baseEnv.notifications.length === 0 && baseEnv.multicastCalls.length === 0,
  );

  // 2. Perubahan status sesi menjadi DIBUKA memicu SESSION_OPENED ke stu-1 saja
  await listeners.schedules({
    docs: [],
    docChanges: () => [
      {
        type: 'modified',
        doc: {
          id: 'sch-1',
          data: () => ({
            courseName: 'Mobile Dev',
            className: 'IF-A',
            room: 'Lab A',
            date: '2026-11-25',
            time: '08:00 - 10:00',
            status: 'DIBUKA',
            assistantId: 'ast-1',
            enrolledStudents: ['stu-1'],
          }),
        },
      },
    ],
  });

  // 3. Perubahan keputusan izin menjadi DITERIMA memicu LEAVE_APPROVED ke stu-1 saja
  await listeners.leave_requests({
    docs: [],
    docChanges: () => [
      {
        type: 'modified',
        doc: {
          id: 'sch-1_stu-1',
          data: () => ({
            scheduleId: 'sch-1',
            courseName: 'Mobile Dev',
            className: 'IF-A',
            studentId: 'stu-1',
            status: 'DITERIMA',
          }),
        },
      },
    ],
  });

  worker.stop();

  assert(
    'Spark worker mengirim SESSION_OPENED dan LEAVE_APPROVED secara real-time hanya ke stu-1',
    baseEnv.notifications.length === 2 &&
      baseEnv.notifications[0].type === 'SESSION_OPENED' &&
      baseEnv.notifications[0].recipientUid === 'stu-1' &&
      baseEnv.notifications[1].type === 'LEAVE_APPROVED' &&
      baseEnv.notifications[1].recipientUid === 'stu-1' &&
      baseEnv.multicastCalls.length === 2,
    JSON.stringify(baseEnv.notifications),
  );

  return results;
}

async function main() {
  console.log('=== Fritz Sprint 3 Automated Tests (Client Rules + Cloud Functions Delivery) ===');
  const clientMod = loadTsModule(path.join(SRC_DIR, 'tests/fritzSprint3.test.ts'));
  const clientSummary = await clientMod.runFritzSprint3Tests();
  const serverResults = await runCloudFunctionDeliveryTests();
  const workerResults = await runSparkWorkerTests();

  const allResults = [...clientSummary.results, ...serverResults, ...workerResults];
  const passed = allResults.filter((r) => r.success).length;
  const failed = allResults.filter((r) => !r.success).length;

  console.log(`\nTotal: ${passed} passed, ${failed} failed (of ${allResults.length})`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
