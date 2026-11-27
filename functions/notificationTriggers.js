/**
 * Fritz — Server-Side Notification Trigger & Delivery Logic (Sprint 3)
 *
 * Modul murni + orkestrator pengiriman FCM yang dipakai oleh Firebase Cloud Functions (`functions/index.js`)
 * serta dapat diuji langsung secara terisolasi tanpa kredensial server di aplikasi React Native.
 */

const PRACTICUM_NOTIFICATION_CHANNEL_ID = 'practicum_updates';
const MAX_MULTICAST_BATCH_SIZE = 500;
const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

const SCHEDULE_DETAIL_FIELDS = [
  { key: 'courseName', label: 'mata praktikum' },
  { key: 'className', label: 'kelas' },
  { key: 'room', label: 'ruangan' },
  { key: 'laboratoryId', label: 'laboratorium' },
  { key: 'date', label: 'tanggal' },
  { key: 'time', label: 'waktu' },
];

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function dedupeRecipientUids(rawUids, excludeUid) {
  if (!Array.isArray(rawUids)) return [];
  const excluded = normalizeText(excludeUid);
  const seen = new Set();

  for (const item of rawUids) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (excluded && trimmed === excluded) continue;
    seen.add(trimmed);
  }

  return Array.from(seen);
}

function areStringArraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, idx) => value === sortedB[idx]);
}

function evaluateSessionOpenedTrigger(before, after, scheduleId) {
  if (!after || !normalizeText(scheduleId)) return null;

  const prevStatus = normalizeText(before && before.status);
  const nextStatus = normalizeText(after.status);

  if (nextStatus !== 'DIBUKA' || prevStatus === 'DIBUKA') {
    return null;
  }

  const recipients = dedupeRecipientUids(after.enrolledStudents, after.assistantId);
  if (recipients.length === 0) {
    return null;
  }

  const courseName = normalizeText(after.courseName) || 'Praktikum';
  const className = normalizeText(after.className);
  const room = normalizeText(after.room);
  const classSuffix = className ? ` (${className})` : '';
  const roomSuffix = room ? ` di ${room}` : '';

  return {
    type: 'SESSION_OPENED',
    title: `Sesi Presensi Dibuka: ${courseName}`,
    body: `Sesi ${courseName}${classSuffix}${roomSuffix} telah dibuka. Segera lakukan presensi.`,
    relatedId: scheduleId,
    scheduleId,
    recipients,
  };
}

function evaluateScheduleUpdatedTrigger(before, after, scheduleId) {
  if (!before || !after || !normalizeText(scheduleId)) return null;

  const changedFields = [];
  const changedLabels = [];

  for (const field of SCHEDULE_DETAIL_FIELDS) {
    const prevVal = normalizeText(before[field.key]);
    const nextVal = normalizeText(after[field.key]);
    if (prevVal !== nextVal) {
      changedFields.push(field.key);
      changedLabels.push(field.label);
    }
  }

  const prevEnrolled = dedupeRecipientUids(before.enrolledStudents, before.assistantId);
  const nextEnrolled = dedupeRecipientUids(after.enrolledStudents, after.assistantId);
  const enrolledChanged = !areStringArraysEqual(prevEnrolled, nextEnrolled);

  if (enrolledChanged) {
    changedFields.push('enrolledStudents');
  }

  if (changedFields.length === 0) {
    return null;
  }

  const onlyEnrolledChanged = enrolledChanged && changedFields.length === 1;
  const recipients = onlyEnrolledChanged
    ? nextEnrolled.filter((uid) => !prevEnrolled.includes(uid))
    : nextEnrolled;

  if (recipients.length === 0) {
    return null;
  }

  const courseName = normalizeText(after.courseName) || 'Praktikum';
  const className = normalizeText(after.className);
  const date = normalizeText(after.date);
  const time = normalizeText(after.time);
  const room = normalizeText(after.room);
  const classSuffix = className ? ` (${className})` : '';
  const summaryParts = [date, time, room].filter(Boolean);
  const scheduleSummary =
    summaryParts.length > 0 ? ` (${summaryParts.join(' · ')})` : '';

  const body = onlyEnrolledChanged
    ? `Anda terdaftar pada jadwal ${courseName}${classSuffix}${scheduleSummary}.`
    : `Perubahan ${changedLabels.join(', ')} pada ${courseName}${classSuffix}${scheduleSummary}.`;

  return {
    type: 'SCHEDULE_UPDATED',
    title: `Perubahan Jadwal: ${courseName}`,
    body,
    relatedId: scheduleId,
    scheduleId,
    recipients,
    changedFields,
  };
}

function evaluateLeaveDecisionTrigger(before, after, leaveId) {
  if (!before || !after || !normalizeText(leaveId)) return null;

  const prevStatus = normalizeText(before.status);
  const nextStatus = normalizeText(after.status);

  if (prevStatus !== 'MENUNGGU') {
    return null;
  }

  if (nextStatus !== 'DITERIMA' && nextStatus !== 'DITOLAK') {
    return null;
  }

  const studentId = normalizeText(after.studentId);
  if (!studentId) {
    return null;
  }

  const scheduleId = normalizeText(after.scheduleId) || leaveId;
  const courseName = normalizeText(after.courseName) || 'Praktikum';
  const className = normalizeText(after.className);
  const classSuffix = className ? ` (${className})` : '';
  const isApproved = nextStatus === 'DITERIMA';

  return {
    type: isApproved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
    title: isApproved ? 'Pengajuan Izin Diterima' : 'Pengajuan Izin Ditolak',
    body: isApproved
      ? `Pengajuan izin Anda untuk ${courseName}${classSuffix} telah DITERIMA oleh asisten.`
      : `Pengajuan izin Anda untuk ${courseName}${classSuffix} DITOLAK oleh asisten.`,
    relatedId: scheduleId,
    scheduleId,
    recipients: [studentId],
  };
}

function extractValidFcmTokens(userData) {
  if (!userData || !Array.isArray(userData.fcmTokens)) {
    return [];
  }

  const unique = new Set();
  for (const token of userData.fcmTokens) {
    if (typeof token === 'string' && token.trim().length > 0) {
      unique.add(token.trim());
    }
  }
  return Array.from(unique);
}

/**
 * Mengirim notifikasi ke setiap penerima yang berhak:
 * 1. Menyimpan dokumen riwayat pada koleksi `notifications`
 * 2. Mengambil `fcmTokens` milik penerima dari koleksi `users`
 * 3. Mengirim push FCM via `sendEachForMulticast` (dipisah per penerima agar `recipientUid` akurat)
 * 4. Membersihkan token yang tidak valid/sudah tidak terdaftar dari Firestore
 * 5. Menangani kegagalan tanpa melempar error yang menghentikan pengiriman ke penerima lain
 */
async function dispatchNotificationsToRecipients(dispatch, deps) {
  const { db, messaging, fieldValue, logger = console } = deps;

  if (!dispatch || !Array.isArray(dispatch.recipients) || dispatch.recipients.length === 0) {
    return {
      attemptedRecipients: 0,
      storedCount: 0,
      sentTokenCount: 0,
      failedTokenCount: 0,
      prunedTokenCount: 0,
      skippedNoTokenCount: 0,
    };
  }

  const summary = {
    attemptedRecipients: dispatch.recipients.length,
    storedCount: 0,
    sentTokenCount: 0,
    failedTokenCount: 0,
    prunedTokenCount: 0,
    skippedNoTokenCount: 0,
  };

  for (const recipientUid of dispatch.recipients) {
    let notificationId = '';

    // 1. Simpan riwayat notifikasi ke koleksi `notifications`
    try {
      const notifRef = db.collection('notifications').doc();
      notificationId = notifRef.id;
      await notifRef.set({
        id: notificationId,
        recipientUid,
        title: dispatch.title,
        body: dispatch.body,
        type: dispatch.type,
        relatedId: dispatch.relatedId,
        createdAt: fieldValue.serverTimestamp(),
        readAt: null,
      });
      summary.storedCount += 1;
    } catch (error) {
      logger.error(
        `[NotificationTrigger] Gagal menyimpan riwayat notifikasi untuk ${recipientUid}:`,
        error,
      );
    }

    // 2. Ambil FCM tokens milik penerima
    let tokens = [];
    try {
      const userSnap = await db.collection('users').doc(recipientUid).get();
      if (userSnap.exists) {
        tokens = extractValidFcmTokens(userSnap.data());
      }
    } catch (error) {
      logger.error(
        `[NotificationTrigger] Gagal membaca profil/token untuk ${recipientUid}:`,
        error,
      );
      continue;
    }

    if (tokens.length === 0) {
      summary.skippedNoTokenCount += 1;
      continue;
    }

    // 3. Kirim FCM multicast dalam batch <= 500 token
    const invalidTokens = [];
    for (let offset = 0; offset < tokens.length; offset += MAX_MULTICAST_BATCH_SIZE) {
      const tokenBatch = tokens.slice(offset, offset + MAX_MULTICAST_BATCH_SIZE);
      try {
        const response = await messaging.sendEachForMulticast({
          tokens: tokenBatch,
          notification: {
            title: dispatch.title,
            body: dispatch.body,
          },
          data: {
            type: dispatch.type,
            relatedId: dispatch.relatedId,
            scheduleId: dispatch.scheduleId || dispatch.relatedId,
            recipientUid,
            notificationId,
            title: dispatch.title,
            body: dispatch.body,
          },
          android: {
            priority: 'high',
            notification: {
              channelId: PRACTICUM_NOTIFICATION_CHANNEL_ID,
              sound: 'default',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
              },
            },
          },
        });

        summary.sentTokenCount += response.successCount || 0;
        summary.failedTokenCount += response.failureCount || 0;

        if (Array.isArray(response.responses)) {
          response.responses.forEach((item, idx) => {
            const errorCode = item && item.error && item.error.code;
            if (!item.success && INVALID_TOKEN_ERROR_CODES.has(errorCode)) {
              invalidTokens.push(tokenBatch[idx]);
            }
          });
        }
      } catch (error) {
        summary.failedTokenCount += tokenBatch.length;
        logger.error(
          `[NotificationTrigger] Gagal mengirim FCM multicast ke ${recipientUid}:`,
          error,
        );
      }
    }

    // 4. Hapus token invalid/expired dari dokumen pengguna
    if (invalidTokens.length > 0) {
      try {
        await db.collection('users').doc(recipientUid).update({
          fcmTokens: fieldValue.arrayRemove(...invalidTokens),
          updatedAt: fieldValue.serverTimestamp(),
        });
        summary.prunedTokenCount += invalidTokens.length;
      } catch (error) {
        logger.error(
          `[NotificationTrigger] Gagal membersihkan token invalid untuk ${recipientUid}:`,
          error,
        );
      }
    }
  }

  return summary;
}

module.exports = {
  PRACTICUM_NOTIFICATION_CHANNEL_ID,
  dedupeRecipientUids,
  evaluateSessionOpenedTrigger,
  evaluateScheduleUpdatedTrigger,
  evaluateLeaveDecisionTrigger,
  extractValidFcmTokens,
  dispatchNotificationsToRecipients,
};
