/**
 * Fritz — Firebase Cloud Functions v2 untuk Push Notification Otomatis (Sprint 3)
 *
 * Pemicu Firestore tepercaya (server-side, tanpa kredensial server di aplikasi client):
 * 1. onScheduleUpdated -> Notifikasi pembukaan sesi (status -> DIBUKA) & perubahan jadwal
 * 2. onLeaveRequestUpdated -> Notifikasi keputusan pengajuan izin (DITERIMA / DITOLAK)
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const {
  evaluateSessionOpenedTrigger,
  evaluateScheduleUpdatedTrigger,
  evaluateLeaveDecisionTrigger,
  dispatchNotificationsToRecipients,
} = require('./notificationTriggers');

if (!admin.apps.length) {
  admin.initializeApp();
}

const REGION = 'asia-southeast2';

function getDeliveryDeps() {
  return {
    db: admin.firestore(),
    messaging: admin.messaging(),
    fieldValue: admin.firestore.FieldValue,
    logger,
  };
}

/**
 * Trigger Firestore pada koleksi `schedules/{scheduleId}`:
 * - Mengirim notifikasi pembukaan sesi ketika status berubah menjadi `DIBUKA`.
 * - Mengirim notifikasi perubahan jadwal ketika detail jadwal/peserta berubah.
 */
exports.onScheduleUpdated = onDocumentUpdated(
  {
    document: 'schedules/{scheduleId}',
    region: REGION,
  },
  async (event) => {
    const before = event.data && event.data.before ? event.data.before.data() : null;
    const after = event.data && event.data.after ? event.data.after.data() : null;
    const scheduleId = event.params.scheduleId;

    if (!before || !after) {
      return;
    }

    const deps = getDeliveryDeps();

    const sessionOpened = evaluateSessionOpenedTrigger(before, after, scheduleId);
    if (sessionOpened) {
      const result = await dispatchNotificationsToRecipients(sessionOpened, deps);
      logger.info('Notifikasi pembukaan sesi diproses', { scheduleId, ...result });
    }

    const scheduleUpdated = evaluateScheduleUpdatedTrigger(before, after, scheduleId);
    if (scheduleUpdated) {
      const result = await dispatchNotificationsToRecipients(scheduleUpdated, deps);
      logger.info('Notifikasi perubahan jadwal diproses', {
        scheduleId,
        changedFields: scheduleUpdated.changedFields,
        ...result,
      });
    }
  },
);

/**
 * Trigger Firestore pada koleksi `leave_requests/{leaveId}`:
 * - Mengirim notifikasi keputusan izin ketika status berubah dari `MENUNGGU`
 *   menjadi `DITERIMA` atau `DITOLAK`, hanya kepada Praktikan yang mengajukan.
 */
exports.onLeaveRequestUpdated = onDocumentUpdated(
  {
    document: 'leave_requests/{leaveId}',
    region: REGION,
  },
  async (event) => {
    const before = event.data && event.data.before ? event.data.before.data() : null;
    const after = event.data && event.data.after ? event.data.after.data() : null;
    const leaveId = event.params.leaveId;

    if (!before || !after) {
      return;
    }

    const leaveDecision = evaluateLeaveDecisionTrigger(before, after, leaveId);
    if (!leaveDecision) {
      return;
    }

    const result = await dispatchNotificationsToRecipients(leaveDecision, getDeliveryDeps());
    logger.info('Notifikasi keputusan izin diproses', {
      leaveId,
      type: leaveDecision.type,
      ...result,
    });
  },
);
