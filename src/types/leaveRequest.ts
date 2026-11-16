/**
 * Fritz — Types khusus modul Pengajuan Izin, Klasifikasi AI & Approval Asisten (Sprint 2)
 * Koleksi Firestore: leave_requests
 * Document ID: ${scheduleId}_${studentId}
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export type LeaveRequestStatus = 'MENUNGGU' | 'DITERIMA' | 'DITOLAK';

export type LeaveAIStatus = 'SUCCESS' | 'FALLBACK';

export type LeaveAICategory =
  | 'Sakit'
  | 'Urusan Keluarga'
  | 'Akademik/Lomba'
  | 'Kendala Teknis'
  | 'Alasan Kurang Kuat'
  | 'AI Tidak Merespon / Perlu Cek Manual';

export type LeaveUrgencyLevel =
  | 'Tinggi'
  | 'Sedang'
  | 'Rendah'
  | 'Perlu Cek Manual';

export interface LeaveAIClassificationResult {
  aiClassification: LeaveAICategory | string;
  aiStatus: LeaveAIStatus;
  urgency: LeaveUrgencyLevel;
  summary: string;
  source: 'remote_api' | 'local_classifier' | 'fallback';
}

export interface LeaveRequestFirestoreDoc {
  id: string;
  scheduleId: string;
  courseName?: string;
  className?: string;
  studentId: string;
  studentName: string;
  nim: string;
  reason: string;
  aiClassification: string;
  aiStatus: LeaveAIStatus;
  aiUrgency?: LeaveUrgencyLevel;
  aiSummary?: string;
  status: LeaveRequestStatus;
  reviewedBy: string | null;
  reviewedAt: FirebaseFirestoreTypes.FieldValue | FirebaseFirestoreTypes.Timestamp | null;
  createdAt: FirebaseFirestoreTypes.FieldValue | FirebaseFirestoreTypes.Timestamp;
}

export interface LeaveRequestItem {
  id: string; // `${scheduleId}_${studentId}`
  scheduleId: string;
  courseName?: string;
  className?: string;
  studentId: string;
  studentName: string;
  nim: string;
  reason: string;
  aiClassification: string;
  aiStatus: LeaveAIStatus;
  aiUrgency: LeaveUrgencyLevel;
  aiSummary: string;
  status: LeaveRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  rawCreatedAt?: FirebaseFirestoreTypes.Timestamp | null;
}
