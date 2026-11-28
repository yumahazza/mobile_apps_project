import { getSafeFirebaseAuth } from '@/services/firebaseClient';
import type { Laboratory } from '@/types/laboratory';
import type {
  LaboratoryMembership,
  MembershipAssignInput,
  MembershipCandidate,
  MembershipImportInput,
  MembershipTransferInput,
} from '@/types/laboratoryMembership';

const API_BASE_URL = String(process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error('API BIRELA belum dikonfigurasi (EXPO_PUBLIC_API_BASE_URL).');
  const user = getSafeFirebaseAuth()?.currentUser;
  if (!user) throw new Error('Sesi login tidak ditemukan. Silakan login kembali.');
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body?.message === 'string' ? body.message : `Permintaan gagal (${response.status}).`);
  }
  return body as T;
}

/** Semua endpoint memverifikasi Firebase ID token dan scope Aslab di server. */
export async function searchMembershipCandidates(params: {
  courseId: string; query: string; role: 'student' | 'asprak';
}): Promise<MembershipCandidate[]> {
  const qs = new URLSearchParams({
    courseId: params.courseId,
    q: params.query.trim(),
    role: params.role,
  });
  const result = await request<{ candidates: MembershipCandidate[] }>(`/memberships/candidates?${qs}`);
  return Array.isArray(result.candidates) ? result.candidates : [];
}

export async function listLaboratoryMemberships(params: {
  courseId: string; laboratoryId?: string; role?: 'student' | 'asprak';
}): Promise<LaboratoryMembership[]> {
  const qs = new URLSearchParams({ courseId: params.courseId });
  if (params.laboratoryId) qs.set('laboratoryId', params.laboratoryId);
  if (params.role) qs.set('memberRole', params.role);
  const result = await request<{ memberships: LaboratoryMembership[] }>(`/memberships?${qs}`);
  return Array.isArray(result.memberships) ? result.memberships : [];
}

export async function assignLaboratoryMember(input: MembershipAssignInput): Promise<LaboratoryMembership> {
  const result = await request<{ membership: LaboratoryMembership }>('/memberships/assign', {
    method: 'POST', body: JSON.stringify(input),
  });
  if (!result.membership?.id) throw new Error('Server tidak mengembalikan membership yang valid.');
  return result.membership;
}

export async function importLaboratoryMembers(input: MembershipImportInput) {
  return request<{ outcomes: Array<{ rowIndex: number; success: boolean; message?: string; membershipId?: string }> }>(
    '/memberships/import', { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function transferLaboratoryMember(input: MembershipTransferInput): Promise<LaboratoryMembership> {
  const result = await request<{ membership: LaboratoryMembership }>('/memberships/transfer', {
    method: 'POST', body: JSON.stringify(input),
  });
  if (!result.membership?.id) throw new Error('Server tidak mengembalikan membership hasil perpindahan.');
  return result.membership;
}

export interface AslabDashboardData {
  totalLaboratories: number;
  totalActiveStudents: number;
  activeSessions: number;
  upcomingSessions: number;
  completedSessions: number;
  sessions: Array<{
    id: string; courseName: string; className: string; laboratoryName: string;
    building?: string; floor?: string; startAt?: string; endAt?: string;
    status: 'DIBUKA' | 'BELUM_DIBUKA' | 'SELESAI';
  }>;
  finance: {
    paidTotal: number;
    outstandingTotal: number;
    paidCount: number;
    unpaidCount: number;
    payments: Array<{
      id: string; studentName: string; nim?: string; laboratoryName: string;
      sessionName: string; amount: number; status: 'paid' | 'unpaid' | 'waived';
      createdAt?: string; paidAt?: string;
    }>;
  };
}

export async function getAslabDashboard(params: {
  courseId: string; period: 'day' | 'week' | 'month'; date: string;
}): Promise<AslabDashboardData> {
  const qs = new URLSearchParams(params);
  return request<AslabDashboardData>(`/aslab/dashboard?${qs}`);
}


export async function listScopedLaboratories(courseId: string): Promise<Laboratory[]> {
  const qs = new URLSearchParams({ courseId });
  const result = await request<{ laboratories: Laboratory[] }>(`/aslab/laboratories?${qs}`);
  return Array.isArray(result.laboratories) ? result.laboratories : [];
}
