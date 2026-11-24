/* global __dirname */
/**
 * Fritz — Spark-Free Trusted Backend Worker untuk Push Notification Otomatis (Sprint 3)
 *
 * Alternatif 100% gratis untuk Firebase Spark Plan (tanpa perlu Blaze/Cloud Functions):
 * - Berjalan sebagai proses backend Node.js terpercaya memakai `firebase-admin`
 * - Memantau perubahan real-time (`onSnapshot`) pada koleksi `schedules` dan `leave_requests`
 * - Memicu pengiriman FCM (`sendEachForMulticast`) & penyimpanan riwayat `notifications`
 *   melalui modul `functions/notificationTriggers.js`
 * - Kredensial server TIDAK pernah disimpan di aplikasi React Native dan TIDAK di-commit ke Git
 *
 * Cara menjalankan:
 * 1. Unduh Service Account JSON dari Firebase Console:
 *    Project Settings -> Service accounts -> Generate new private key
 * 2. Simpan sebagai `functions/serviceAccountKey.json` (otomatis terabaikan oleh `functions/.gitignore`)
 *    ATAU set env `GOOGLE_APPLICATION_CREDENTIALS` / `FIREBASE_SERVICE_ACCOUNT_JSON`
 * 3. Jalankan: `cd functions && npm run worker`
 */

const fs = require('fs');
const path = require('path');
const {
  evaluateSessionOpenedTrigger,
  evaluateScheduleUpdatedTrigger,
  evaluateLeaveDecisionTrigger,
  dispatchNotificationsToRecipients,
} = require('./notificationTriggers');

function clonePlainObject(data) {
  if (!data || typeof data !== 'object') return null;
  return { ...data };
}

/**
 * Menjalankan listener Firestore untuk `schedules` dan `leave_requests`.
 * Di-export agar dapat diuji secara terisolasi maupun dijalankan sebagai proses standalone.
 */
function startNotificationWorker(deps) {
  const { db, messaging, fieldValue, logger = console } = deps;
  const schedulesCache = new Map();
  const leaveRequestsCache = new Map();
  let schedulesInitialized = false;
  let leavesInitialized = false;

  const deliveryDeps = { db, messaging, fieldValue, logger };

  const unsubscribeSchedules = db.collection('schedules').onSnapshot(
    async (snapshot) => {
      if (!schedulesInitialized) {
        snapshot.docs.forEach((docSnap) => {
          schedulesCache.set(docSnap.id, clonePlainObject(docSnap.data()));
        });
        schedulesInitialized = true;
        logger.info(
          `[Worker] Snapshot awal schedules dimuat (${schedulesCache.size} jadwal). Memantau perubahan...`,
        );
        return;
      }

      for (const change of snapshot.docChanges()) {
        const docId = change.doc.id;
        const after = clonePlainObject(change.doc.data());

        if (change.type === 'added') {
          schedulesCache.set(docId, after);
          continue;
        }

        if (change.type === 'removed') {
          schedulesCache.delete(docId);
          continue;
        }

        if (change.type === 'modified') {
          const before = schedulesCache.get(docId) || null;
          schedulesCache.set(docId, after);

          const sessionOpened = evaluateSessionOpenedTrigger(before, after, docId);
          if (sessionOpened) {
            const summary = await dispatchNotificationsToRecipients(
              sessionOpened,
              deliveryDeps,
            );
            logger.info(`[Worker] SESSION_OPENED (${docId}):`, summary);
          }

          const scheduleUpdated = evaluateScheduleUpdatedTrigger(
            before,
            after,
            docId,
          );
          if (scheduleUpdated) {
            const summary = await dispatchNotificationsToRecipients(
              scheduleUpdated,
              deliveryDeps,
            );
            logger.info(`[Worker] SCHEDULE_UPDATED (${docId}):`, summary);
          }
        }
      }
    },
    (error) => {
      logger.error('[Worker] Listener schedules mengalami error:', error);
    },
  );

  const unsubscribeLeaves = db.collection('leave_requests').onSnapshot(
    async (snapshot) => {
      if (!leavesInitialized) {
        snapshot.docs.forEach((docSnap) => {
          leaveRequestsCache.set(docSnap.id, clonePlainObject(docSnap.data()));
        });
        leavesInitialized = true;
        logger.info(
          `[Worker] Snapshot awal leave_requests dimuat (${leaveRequestsCache.size} pengajuan). Memantau perubahan...`,
        );
        return;
      }

      for (const change of snapshot.docChanges()) {
        const docId = change.doc.id;
        const after = clonePlainObject(change.doc.data());

        if (change.type === 'added') {
          leaveRequestsCache.set(docId, after);
          continue;
        }

        if (change.type === 'removed') {
          leaveRequestsCache.delete(docId);
          continue;
        }

        if (change.type === 'modified') {
          const before = leaveRequestsCache.get(docId) || null;
          leaveRequestsCache.set(docId, after);

          const leaveDecision = evaluateLeaveDecisionTrigger(before, after, docId);
          if (leaveDecision) {
            const summary = await dispatchNotificationsToRecipients(
              leaveDecision,
              deliveryDeps,
            );
            logger.info(
              `[Worker] ${leaveDecision.type} (${docId}):`,
              summary,
            );
          }
        }
      }
    },
    (error) => {
      logger.error('[Worker] Listener leave_requests mengalami error:', error);
    },
  );

  return {
    stop: () => {
      unsubscribeSchedules();
      unsubscribeLeaves();
    },
  };
}

function loadServiceAccountCredential(admin) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    return admin.credential.cert(parsed);
  }

  const candidatePath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(__dirname, 'serviceAccountKey.json');

  if (fs.existsSync(candidatePath)) {
    const raw = fs.readFileSync(candidatePath, 'utf8');
    return admin.credential.cert(JSON.parse(raw));
  }

  throw new Error(
    'Kredensial Firebase Service Account belum ditemukan.\n' +
      'Unduh private key dari Firebase Console -> Project Settings -> Service accounts,\n' +
      'lalu simpan sebagai `functions/serviceAccountKey.json` atau set env GOOGLE_APPLICATION_CREDENTIALS.',
  );
}

function runStandaloneWorker() {
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    const credential = loadServiceAccountCredential(admin);
    admin.initializeApp({ credential });
  }

  console.log(
    '[Worker] Memulai Spark-Free Push Notification Worker untuk ppk-praktikum-2a6ab...',
  );

  const worker = startNotificationWorker({
    db: admin.firestore(),
    messaging: admin.messaging(),
    fieldValue: admin.firestore.FieldValue,
    logger: console,
  });

  const shutdown = () => {
    console.log('\n[Worker] Menghentikan listener Firestore...');
    worker.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  try {
    runStandaloneWorker();
  } catch (error) {
    console.error('[Worker] Gagal memulai:', error.message || error);
    process.exit(1);
  }
}

module.exports = {
  startNotificationWorker,
};
