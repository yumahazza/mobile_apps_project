/* global __dirname */
/**
 * Pengujian Integrasi & End-to-End (UAT) Sprint 2
 * Mengkompilasi dan mengeksekusi kode TypeScript produksi (src/services/*, src/tests/*)
 * dengan simulator in-memory Firebase Auth & Cloud Firestore yang menerapkan kontrak
 * transaksi, listener real-time (onSnapshot), serta validasi aturan keamanan tim.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

// ============================================================================
// 1. IN-MEMORY FIREBASE AUTH & FIRESTORE SIMULATOR
// ============================================================================
function createFirebaseSimulator() {
  const store = new Map(); // path "collection/docId" -> cloned plain object
  const collectionListeners = new Map(); // collectionName -> Set<() => void>
  const docListeners = new Map(); // docPath -> Set<() => void>
  let currentUser = null;
  let autoIdCounter = 1;

  function cloneValue(val) {
    if (val === null || val === undefined) return val;
    if (val instanceof TimestampValue) return val;
    if (Array.isArray(val)) return val.map(cloneValue);
    if (typeof val === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(val)) {
        out[k] = cloneValue(v);
      }
      return out;
    }
    return val;
  }

  class TimestampValue {
    constructor(ms) {
      this._ms = ms;
    }
    toDate() {
      return new Date(this._ms);
    }
    toMillis() {
      return this._ms;
    }
  }

  const SERVER_TIMESTAMP_SENTINEL = { __isServerTimestamp: true };

  function resolveServerTimestamps(data, nowMs) {
    const out = {};
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && v.__isServerTimestamp) {
        out[k] = new TimestampValue(nowMs);
      } else {
        out[k] = cloneValue(v);
      }
    }
    return out;
  }

  function makeSnap(docPath) {
    const existsFlag = store.has(docPath);
    const id = docPath.split('/').pop();
    const dataObj = existsFlag ? cloneValue(store.get(docPath)) : undefined;
    return {
      id,
      exists: () => existsFlag,
      data: () => dataObj,
    };
  }

  function notify(docPath) {
    const colName = docPath.split('/')[0];
    const dListeners = docListeners.get(docPath);
    if (dListeners) {
      dListeners.forEach(fn => fn());
    }
    const cListeners = collectionListeners.get(colName);
    if (cListeners) {
      cListeners.forEach(fn => fn());
    }
  }

  function matchesWhere(docData, filters) {
    return filters.every(([field, op, value]) => {
      const target = docData[field];
      if (op === '==') return target === value;
      if (op === 'array-contains') return Array.isArray(target) && target.includes(value);
      throw new Error(`Unsupported query operator in simulator: ${op}`);
    });
  }

  function evaluateQuery(q) {
    const docs = [];
    for (const [docPath, raw] of store.entries()) {
      const [col] = docPath.split('/');
      if (col !== q.collectionName) continue;
      if (matchesWhere(raw, q.filters)) {
        const id = docPath.split('/')[1];
        const cloned = cloneValue(raw);
        docs.push({
          id,
          exists: () => true,
          data: () => cloned,
        });
      }
    }
    return { docs };
  }

  const authModule = {
    getAuth: () => ({
      get currentUser() {
        return currentUser;
      },
    }),
    createUserWithEmailAndPassword: async (_auth, email) => {
      const uid = `uid_${email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')}_${autoIdCounter++}`;
      currentUser = { uid, email };
      return { user: currentUser };
    },
    signInWithEmailAndPassword: async (_auth, email) => {
      for (const [docPath, raw] of store.entries()) {
        if (docPath.startsWith('users/') && raw.email === email) {
          currentUser = { uid: raw.uid, email: raw.email };
          return { user: currentUser };
        }
      }
      const err = new Error('User not found');
      err.code = 'auth/user-not-found';
      throw err;
    },
    signOut: async () => {
      currentUser = null;
    },
    __setMockUser: user => {
      currentUser = user;
    },
  };

  const firestoreModule = {
    getFirestore: () => ({ __isSimFirestore: true }),
    collection: (_db, name) => ({ __type: 'collection', name }),
    doc: (colOrDb, colOrId, maybeId) => {
      if (typeof colOrDb === 'object' && colOrDb.__type === 'collection') {
        return { __type: 'doc', path: `${colOrDb.name}/${colOrId}`, id: colOrId };
      }
      return { __type: 'doc', path: `${colOrId}/${maybeId}`, id: maybeId };
    },
    query: (colRef, ...constraints) => ({
      __type: 'query',
      collectionName: colRef.name,
      filters: constraints.map(c => c.filter),
    }),
    where: (field, op, value) => ({ __type: 'where', filter: [field, op, value] }),
    serverTimestamp: () => SERVER_TIMESTAMP_SENTINEL,
    getDoc: async docRef => makeSnap(docRef.path),
    getDocs: async target => {
      if (target.__type === 'collection') {
        return evaluateQuery({ collectionName: target.name, filters: [] });
      }
      return evaluateQuery(target);
    },
    setDoc: async (docRef, data) => {
      store.set(docRef.path, resolveServerTimestamps(data, Date.now()));
      notify(docRef.path);
    },
    addDoc: async (colRef, data) => {
      const id = `doc_${autoIdCounter++}`;
      const docPath = `${colRef.name}/${id}`;
      store.set(docPath, resolveServerTimestamps(data, Date.now()));
      notify(docPath);
      return { __type: 'doc', path: docPath, id };
    },
    updateDoc: async (docRef, patch) => {
      if (!store.has(docRef.path)) {
        throw new Error(`Document not found: ${docRef.path}`);
      }
      const existing = store.get(docRef.path);
      const resolved = resolveServerTimestamps(patch, Date.now());
      store.set(docRef.path, { ...existing, ...resolved });
      notify(docRef.path);
    },
    deleteDoc: async docRef => {
      store.delete(docRef.path);
      notify(docRef.path);
    },
    runTransaction: async (_db, fn) => {
      const stagedWrites = [];
      const transaction = {
        get: async docRef => makeSnap(docRef.path),
        set: (docRef, data) => stagedWrites.push({ op: 'set', path: docRef.path, data }),
        update: (docRef, patch) => stagedWrites.push({ op: 'update', path: docRef.path, patch }),
      };
      const result = await fn(transaction);
      const nowMs = Date.now();
      for (const write of stagedWrites) {
        if (write.op === 'set') {
          store.set(write.path, resolveServerTimestamps(write.data, nowMs));
        } else if (write.op === 'update') {
          const existing = store.get(write.path) || {};
          store.set(write.path, { ...existing, ...resolveServerTimestamps(write.patch, nowMs) });
        }
        notify(write.path);
      }
      return result;
    },
    onSnapshot: (target, onNext) => {
      if (target.__type === 'doc') {
        const emit = () => onNext(makeSnap(target.path));
        if (!docListeners.has(target.path)) docListeners.set(target.path, new Set());
        docListeners.get(target.path).add(emit);
        emit();
        return () => docListeners.get(target.path)?.delete(emit);
      }
      const q =
        target.__type === 'collection'
          ? { collectionName: target.name, filters: [] }
          : target;
      const emit = () => onNext(evaluateQuery(q));
      if (!collectionListeners.has(q.collectionName)) {
        collectionListeners.set(q.collectionName, new Set());
      }
      collectionListeners.get(q.collectionName).add(emit);
      emit();
      return () => collectionListeners.get(q.collectionName)?.delete(emit);
    },
    __store: store,
  };

  return { authModule, firestoreModule };
}

// ============================================================================
// 2. ON-THE-FLY TYPESCRIPT LOADER UNTUK MODUL `src/`
// ============================================================================
function installTsLoader(sim) {
  const originalLoad = Module._load;
  const compiledCache = new Map();

  function resolveTsFile(basePath) {
    const candidates = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.tsx`,
      `${basePath}.js`,
      path.join(basePath, 'index.ts'),
      path.join(basePath, 'index.js'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
    return null;
  }

  function loadTsModule(filePath) {
    const canonical = path.resolve(filePath);
    if (compiledCache.has(canonical)) {
      return compiledCache.get(canonical).exports;
    }

    const source = fs.readFileSync(canonical, 'utf8');
    const transpiled = ts.transpileModule(source, {
      fileName: canonical,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
    });

    const mod = { exports: {} };
    compiledCache.set(canonical, mod);

    const localRequire = request => {
      if (request === '@react-native-firebase/auth') return sim.authModule;
      if (request === '@react-native-firebase/firestore') return sim.firestoreModule;
      if (request.startsWith('@/')) {
        const target = resolveTsFile(path.join(SRC_DIR, request.slice(2)));
        if (!target) throw new Error(`Cannot resolve alias '${request}' from ${canonical}`);
        if (target.endsWith('.ts') || target.endsWith('.tsx')) return loadTsModule(target);
        return originalLoad(target, mod, false);
      }
      if (request.startsWith('.')) {
        const target = resolveTsFile(path.resolve(path.dirname(canonical), request));
        if (target && (target.endsWith('.ts') || target.endsWith('.tsx'))) {
          return loadTsModule(target);
        }
        if (target) return originalLoad(target, mod, false);
      }
      return originalLoad(request, mod, false);
    };

    const wrapper = new Function(
      'exports',
      'require',
      'module',
      '__filename',
      '__dirname',
      transpiled.outputText,
    );
    wrapper(mod.exports, localRequire, mod, canonical, path.dirname(canonical));
    return mod.exports;
  }

  Module._load = function (request, parent, isMain) {
    if (request === '@react-native-firebase/auth') return sim.authModule;
    if (request === '@react-native-firebase/firestore') return sim.firestoreModule;
    return originalLoad.call(this, request, parent, isMain);
  };

  return { loadTsModule, restore: () => { Module._load = originalLoad; } };
}

// ============================================================================
// 3. EKSEKUSI TEST SUITE PRODUKSI + SKENARIO E2E (UAT)
// ============================================================================
async function main() {
  const sim = createFirebaseSimulator();
  const { loadTsModule, restore } = installTsLoader(sim);

  const results = [];
  function assert(name, condition, detail = '') {
    results.push({ name, success: Boolean(condition), detail });
    if (condition) {
      console.log(`[PASS] ${name}`);
    } else {
      console.error(`[FAIL] ${name}${detail ? ` -> ${detail}` : ''}`);
    }
  }

  async function expectThrows(name, fn, expectedSubstring) {
    try {
      await fn();
      assert(name, false, 'Seharusnya gagal/melempar error tetapi justru berhasil.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const ok = !expectedSubstring || msg.includes(expectedSubstring);
      assert(name, ok, `Pesan error: "${msg}"`);
    }
  }

  try {
    console.log('=== 1. MENJALANKAN UNIT TEST TYPESCRIPT PRODUKSI (FRITZ & LINTANG) ===\n');
    const { runFritzTests } = loadTsModule(path.join(SRC_DIR, 'tests/fritzFeatures.test.ts'));
    const { runLintangTests } = loadTsModule(path.join(SRC_DIR, 'tests/lintangFeatures.test.ts'));

    const fritzRes = await runFritzTests();
    assert(
      `src/tests/fritzFeatures.test.ts (${fritzRes.passed} passed, ${fritzRes.failed} failed)`,
      fritzRes.failed === 0 && fritzRes.passed > 0,
    );

    const lintangRes = await runLintangTests();
    assert(
      `src/tests/lintangFeatures.test.ts (${lintangRes.passed} passed, ${lintangRes.failed} failed)`,
      lintangRes.failed === 0 && lintangRes.passed > 0,
    );

    console.log('\n=== 2. SIMULASI END-TO-END (UAT) LINTAS MODUL PRODUKSI ===\n');

    const authService = loadTsModule(path.join(SRC_DIR, 'services/authService.ts'));
    const scheduleService = loadTsModule(path.join(SRC_DIR, 'services/practicumScheduleService.ts'));
    const sessionControl = loadTsModule(path.join(SRC_DIR, 'services/sessionControlService.ts'));
    const attendanceService = loadTsModule(path.join(SRC_DIR, 'services/attendanceService.ts'));
    const leaveService = loadTsModule(path.join(SRC_DIR, 'services/leaveRequestService.ts'));
    const feedbackService = loadTsModule(path.join(SRC_DIR, 'services/feedbackSentimentService.ts'));

    // --- Skenario 1: Hana (Auth, Register Student, Profile & Assistant Provisioning) ---
    await expectThrows(
      'UAT-Auth-1: Menolak registrasi email tidak valid',
      () => authService.registerWithEmail('bukan-email', 'secret123', { name: 'Budi' }),
      'Format email tidak valid',
    );
    await expectThrows(
      'UAT-Auth-2: Menolak registrasi password < 6 karakter',
      () => authService.registerWithEmail('budi@univ.ac.id', '123', { name: 'Budi' }),
      'Password minimal 6 karakter',
    );

    await authService.registerWithEmail('budi@univ.ac.id', 'secret123', {
      name: 'Budi Santoso',
      nim: '210001',
      department: 'Informatika',
    });
    const student1Uid = sim.authModule.getAuth().currentUser.uid;
    const student1Profile = await authService.getUserProfile(student1Uid);
    assert(
      'UAT-Auth-3: Registrasi menyimpan profil user dengan role default student',
      student1Profile.role === 'student' && student1Profile.nim === '210001',
      JSON.stringify(student1Profile),
    );

    await authService.registerWithEmail('siti@univ.ac.id', 'secret123', {
      name: 'Siti Aminah',
      nim: '210002',
      department: 'Informatika',
    });
    const student2Uid = sim.authModule.getAuth().currentUser.uid;

    await authService.registerWithEmail('andi@univ.ac.id', 'secret123', {
      name: 'Andi Nonpeserta',
      nim: '210003',
    });
    const student3Uid = sim.authModule.getAuth().currentUser.uid;

    // Provision 1 asisten utama & 1 asisten lain di koleksi users
    const assistantUid = 'ast_hana_001';
    const otherAssistantUid = 'ast_other_999';
    await sim.firestoreModule.setDoc(
      sim.firestoreModule.doc(sim.firestoreModule.getFirestore(), 'users', assistantUid),
      {
        uid: assistantUid,
        name: 'Asisten Hana',
        email: 'asisten@univ.ac.id',
        role: 'assistant',
        department: 'Lab Komputer',
      },
    );
    await sim.firestoreModule.setDoc(
      sim.firestoreModule.doc(sim.firestoreModule.getFirestore(), 'users', otherAssistantUid),
      {
        uid: otherAssistantUid,
        name: 'Asisten Lain',
        email: 'asisten2@univ.ac.id',
        role: 'assistant',
      },
    );

    await authService.signOut();
    assert('UAT-Auth-4: Logout membersihkan user aktif', sim.authModule.getAuth().currentUser === null);

    // --- Skenario 2: Birela (CRUD Jadwal, Validasi & Filter Role Real-time) ---
    await authService.signInWithEmail('asisten@univ.ac.id', 'secret123');
    const studentDirectory = await scheduleService.getStudentDirectory();
    assert(
      'UAT-Schedule-1: getStudentDirectory memuat 3 mahasiswa dengan role student',
      studentDirectory.length === 3,
      `Count: ${studentDirectory.length}`,
    );

    assert(
      'UAT-Schedule-2: Validasi menolak tanggal kalender tidak valid (2026-02-30)',
      scheduleService.validateScheduleInput({
        courseName: 'Mobile',
        className: 'A',
        room: 'Lab 1',
        date: '2026-02-30',
        time: '08:00 - 10:00',
        enrolledStudents: [],
      }) !== null,
    );

    assert(
      'UAT-Schedule-3: Validasi menolak waktu selesai <= waktu mulai',
      scheduleService.validateScheduleInput({
        courseName: 'Mobile',
        className: 'A',
        room: 'Lab 1',
        date: '2026-11-20',
        time: '10:00 - 09:00',
        enrolledStudents: [],
      }) !== null,
    );

    const scheduleId = await scheduleService.createPracticumSchedule(
      {
        courseName: 'Pemrograman Mobile',
        className: 'Kelas A',
        room: 'Lab Komputer 1',
        date: '2026-11-20',
        time: '08:00 - 10:00',
        enrolledStudents: [student1Uid],
      },
      { uid: assistantUid, name: 'Asisten Hana' },
    );

    await scheduleService.updatePracticumParticipants(scheduleId, [student1Uid, student2Uid]);

    let assistantSchedules = [];
    const unsubAssistantSched = scheduleService.subscribeToPracticumSchedules(
      assistantUid,
      'assistant',
      list => { assistantSchedules = list; },
      err => assert('Listener jadwal asisten error', false, err),
    );
    let student1Schedules = [];
    const unsubStudent1Sched = scheduleService.subscribeToPracticumSchedules(
      student1Uid,
      'student',
      list => { student1Schedules = list; },
      err => assert('Listener jadwal student 1 error', false, err),
    );
    let student3Schedules = [];
    const unsubStudent3Sched = scheduleService.subscribeToPracticumSchedules(
      student3Uid,
      'student',
      list => { student3Schedules = list; },
      err => assert('Listener jadwal student 3 error', false, err),
    );

    assert(
      'UAT-Schedule-4: Jadwal sinkron real-time ke asisten & praktikan terdaftar, dan terfilter bagi non-peserta',
      assistantSchedules.length === 1 &&
        assistantSchedules[0].totalStudents === 2 &&
        student1Schedules.length === 1 &&
        student3Schedules.length === 0,
    );

    // --- Skenario 3: Lintang (Kontrol Sesi & Presensi + Anti Duplikasi) ---
    await authService.signInWithEmail('budi@univ.ac.id', 'secret123');
    await expectThrows(
      'UAT-Attendance-1: Praktikan ditolak presensi sebelum sesi DIBUKA',
      () =>
        attendanceService.submitPracticumAttendance({
          scheduleId,
          studentId: student1Uid,
          studentName: 'Budi Santoso',
          nim: '210001',
        }),
      'belum dibuka',
    );

    await authService.signInWithEmail('asisten@univ.ac.id', 'secret123');
    await expectThrows(
      'UAT-Session-1: Asisten lain ditolak membuka sesi yang bukan miliknya',
      () => sessionControl.openPracticumSession(scheduleId, otherAssistantUid),
      'Akses ditolak',
    );
    await expectThrows(
      'UAT-Session-2: Sesi BELUM_DIBUKA ditolak langsung ditutup ke SELESAI',
      () => sessionControl.closePracticumSession(scheduleId, assistantUid),
      'BELUM_DIBUKA',
    );

    const openResult = await sessionControl.openPracticumSession(scheduleId, assistantUid);
    assert(
      'UAT-Session-3: Asisten membuka sesi (BELUM_DIBUKA -> DIBUKA) & listener mahasiswa langsung terupdate',
      openResult.newStatus === 'DIBUKA' && student1Schedules[0]?.status === 'DIBUKA',
    );

    // Student 1 presensi Hadir
    await authService.signInWithEmail('budi@univ.ac.id', 'secret123');
    const attRes = await attendanceService.submitPracticumAttendance({
      scheduleId,
      studentId: student1Uid,
      studentName: 'Budi Santoso',
      nim: '210001',
    });
    assert(
      'UAT-Attendance-2: Praktikan terdaftar berhasil presensi saat DIBUKA dengan doc ID komposit',
      attRes.success && attRes.attendanceId === `${scheduleId}_${student1Uid}`,
    );

    await expectThrows(
      'UAT-Attendance-3: Mencegah presensi ganda pada sesi yang sama',
      () =>
        attendanceService.submitPracticumAttendance({
          scheduleId,
          studentId: student1Uid,
          studentName: 'Budi Santoso',
          nim: '210001',
        }),
      'sudah melakukan presensi',
    );

    await authService.signInWithEmail('andi@univ.ac.id', 'secret123');
    await expectThrows(
      'UAT-Attendance-4: Menolak presensi mahasiswa yang tidak terdaftar pada kelas',
      () =>
        attendanceService.submitPracticumAttendance({
          scheduleId,
          studentId: student3Uid,
          studentName: 'Andi Nonpeserta',
          nim: '210003',
        }),
      'tidak terdaftar',
    );

    // --- Skenario 4: Fritz (Pengajuan Izin, AI + Fallback, Approval 1x, Sinkronisasi Rekap) ---
    await authService.signInWithEmail('budi@univ.ac.id', 'secret123');
    await expectThrows(
      'UAT-Leave-1: Mahasiswa yang sudah tercatat Hadir ditolak mengajukan izin',
      () =>
        leaveService.submitLeaveRequest({
          scheduleId,
          courseName: 'Pemrograman Mobile',
          className: 'Kelas A',
          studentId: student1Uid,
          studentName: 'Budi Santoso',
          nim: '210001',
          reason: 'Saya izin tidak bisa hadir karena sakit demam',
        }),
      'sudah tercatat Hadir',
    );

    await authService.signInWithEmail('siti@univ.ac.id', 'secret123');
    let student2LeaveLive = null;
    const unsubLeave2 = leaveService.subscribeToStudentLeaveForSchedule(
      scheduleId,
      student2Uid,
      item => { student2LeaveLive = item; },
      err => assert('Listener leave student 2 error', false, err),
    );

    const leaveSubmitRes = await leaveService.submitLeaveRequest({
      scheduleId,
      courseName: 'Pemrograman Mobile',
      className: 'Kelas A',
      studentId: student2Uid,
      studentName: 'Siti Aminah',
      nim: '210002',
      reason: 'Saya sedang sakit demam tinggi sejak semalam dan berobat ke klinik.',
    });
    assert(
      'UAT-Leave-2: Pengajuan izin diklasifikasi AI ("Sakit") dan wajib berstatus awal MENUNGGU',
      leaveSubmitRes.aiClassification === 'Sakit' &&
        leaveSubmitRes.aiStatus === 'SUCCESS' &&
        leaveSubmitRes.status === 'MENUNGGU' &&
        student2LeaveLive?.status === 'MENUNGGU',
    );

    await expectThrows(
      'UAT-Leave-3: Mencegah pengajuan izin ganda oleh mahasiswa yang sama pada sesi yang sama',
      () =>
        leaveService.submitLeaveRequest({
          scheduleId,
          studentId: student2Uid,
          studentName: 'Siti Aminah',
          nim: '210002',
          reason: 'Pengajuan kedua yang harus ditolak sistem.',
        }),
      'sudah mengajukan izin',
    );

    // Uji fallback AI tanpa memblokir penyimpanan pada jadwal kedua
    const schedule2Id = await scheduleService.createPracticumSchedule(
      {
        courseName: 'Basis Data',
        className: 'Kelas B',
        room: 'Lab Komputer 2',
        date: '2026-11-21',
        time: '13:00 - 15:00',
        enrolledStudents: [student2Uid],
      },
      { uid: assistantUid, name: 'Asisten Hana' },
    );
    const leaveFallbackRes = await leaveService.submitLeaveRequest({
      scheduleId: schedule2Id,
      studentId: student2Uid,
      studentName: 'Siti Aminah',
      nim: '210002',
      reason: 'Alasan tidak terduga dengan simulasi AI offline.',
      aiOptions: { simulateFailure: true },
    });
    assert(
      'UAT-Leave-4: Saat AI gagal/timeout, izin tetap tersimpan sebagai MENUNGGU dengan label fallback',
      leaveFallbackRes.aiClassification === 'AI Tidak Merespon / Perlu Cek Manual' &&
        leaveFallbackRes.aiStatus === 'FALLBACK' &&
        leaveFallbackRes.status === 'MENUNGGU',
    );

    // Approval Asisten + Sinkronisasi ke attendances
    let realtimeAttendances = [];
    const unsubAttRecap = attendanceService.subscribeToScheduleAttendances(
      scheduleId,
      list => { realtimeAttendances = list; },
      err => assert('Listener rekap attendance error', false, err),
    );

    await authService.signInWithEmail('asisten2@univ.ac.id', 'secret123');
    await expectThrows(
      'UAT-Leave-5: Asisten lain yang bukan pengampu ditolak memproses izin',
      () =>
        leaveService.reviewLeaveRequest({
          scheduleId,
          studentId: student2Uid,
          decision: 'DITERIMA',
          assistantId: otherAssistantUid,
          assistantName: 'Asisten Lain',
        }),
      'Akses ditolak',
    );

    await authService.signInWithEmail('asisten@univ.ac.id', 'secret123');

    const reviewRes = await leaveService.reviewLeaveRequest({
      scheduleId,
      studentId: student2Uid,
      decision: 'DITERIMA',
      assistantId: assistantUid,
      assistantName: 'Asisten Hana',
    });
    assert(
      'UAT-Leave-6: Keputusan DITERIMA mengupdate status real-time & menyinkronkan Izin ke attendances',
      reviewRes.status === 'DITERIMA' &&
        student2LeaveLive?.status === 'DITERIMA' &&
        realtimeAttendances.some(a => a.studentId === student2Uid && a.status === 'Izin'),
    );

    await expectThrows(
      'UAT-Leave-7: Pengajuan izin yang sudah diputuskan tidak dapat diputuskan ulang',
      () =>
        leaveService.reviewLeaveRequest({
          scheduleId,
          studentId: student2Uid,
          decision: 'DITOLAK',
          assistantId: assistantUid,
          assistantName: 'Asisten Hana',
        }),
      'sudah diproses',
    );

    const stats = attendanceService.calculateAttendanceStats(2, realtimeAttendances);
    assert(
      'UAT-Recap-1: Metrik kehadiran akurat (1 Hadir, 1 Izin, 0 Alfa, 50% Hadir)',
      stats.hadirCount === 1 &&
        stats.izinCount === 1 &&
        stats.alfaCount === 0 &&
        stats.attendancePercentage === 50,
      JSON.stringify(stats),
    );

    // --- Skenario 5: Lintang (Tutup Sesi, Feedback Pasca-Praktikum & Sentimen AI) ---
    await authService.signInWithEmail('budi@univ.ac.id', 'secret123');
    await expectThrows(
      'UAT-Feedback-1: Praktikan ditolak mengirim pesan & kesan sebelum sesi SELESAI',
      () =>
        feedbackService.submitPracticumFeedback({
          scheduleId,
          studentId: student1Uid,
          studentName: 'Budi Santoso',
          comment: 'Penjelasan materi praktikum hari ini sangat bagus.',
        }),
      'SELESAI',
    );

    await authService.signInWithEmail('asisten@univ.ac.id', 'secret123');
    const closeRes = await sessionControl.closePracticumSession(scheduleId, assistantUid);
    assert(
      'UAT-Session-4: Asisten menutup sesi (DIBUKA -> SELESAI) & listener mahasiswa langsung melihat SELESAI',
      closeRes.newStatus === 'SELESAI' && student1Schedules[0]?.status === 'SELESAI',
    );

    await expectThrows(
      'UAT-Session-5: Sesi yang sudah SELESAI tidak dapat dibuka kembali',
      () => sessionControl.openPracticumSession(scheduleId, assistantUid),
      'tidak dapat dibuka kembali',
    );

    await authService.signInWithEmail('budi@univ.ac.id', 'secret123');
    let assistantFeedbacks = [];
    const unsubFb = feedbackService.subscribeToScheduleFeedbacks(
      scheduleId,
      list => { assistantFeedbacks = list; },
      err => assert('Listener feedback asisten error', false, err),
    );

    const fbRes = await feedbackService.submitPracticumFeedback({
      scheduleId,
      studentId: student1Uid,
      studentName: 'Budi Santoso',
      comment: 'Asisten menjelaskan materi praktikum dengan sangat baik dan jelas.',
    });
    assert(
      'UAT-Feedback-2: Feedback tersimpan pasca-sesi dengan label sentimen AI & langsung tampil di rekap asisten',
      fbRes.success &&
        ['Positif', 'Negatif', 'Netral', 'Tidak Terklasifikasi'].includes(fbRes.sentiment) &&
        assistantFeedbacks.length === 1 &&
        assistantFeedbacks[0].sentiment === fbRes.sentiment,
      `Sentiment: ${fbRes.sentiment}`,
    );

    await expectThrows(
      'UAT-Feedback-3: Mencegah pengiriman feedback ganda pada sesi yang sama',
      () =>
        feedbackService.submitPracticumFeedback({
          scheduleId,
          studentId: student1Uid,
          studentName: 'Budi Santoso',
          comment: 'Feedback kedua yang seharusnya ditolak.',
        }),
      'sudah mengirimkan',
    );

    unsubAssistantSched();
    unsubStudent1Sched();
    unsubStudent3Sched();
    unsubLeave2();
    unsubAttRecap();
    unsubFb();

    // --- Skenario 6: Verifikasi Kontrak firestore.rules ---
    console.log('\n=== 3. VERIFIKASI KONTRAK FIRESTORE SECURITY RULES ===\n');
    const rulesContent = fs.readFileSync(path.join(ROOT_DIR, 'firestore.rules'), 'utf8');
    assert(
      'Rules-1: users create membatasi role student untuk self-registration',
      rulesContent.includes("request.resource.data.role == 'student'"),
    );
    assert(
      'Rules-2: schedules update memvalidasi transisi status (validSessionTransition)',
      rulesContent.includes('validSessionTransition()'),
    );
    assert(
      'Rules-3: feedbacks get mendukung pengecekan dokumen yang belum ada (missingOwnStudentDocument)',
      rulesContent.includes('missingOwnStudentDocument(feedbackId)'),
    );
    assert(
      'Rules-4: leave_requests update mensyaratkan transaksi atomik attendances (getAfter)',
      rulesContent.includes('getAfter(') && rulesContent.includes("status == 'Izin'"),
    );
  } finally {
    restore();
  }

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`\n========================================`);
  console.log(`TOTAL UJI INTEGRASI & UAT: ${passed + failed}`);
  console.log(`HASIL: ${passed} PASS, ${failed} FAIL`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
