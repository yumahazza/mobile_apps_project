export type LaboratoryMemberRole = 'student' | 'asprak';
export type MembershipStatus = 'active' | 'inactive' | 'transferred';

export interface LaboratoryMembership {
  id: string;
  courseId: string;
  laboratoryId: string;
  laboratoryCode: string;
  memberUid: string;
  memberRole: LaboratoryMemberRole;
  displayName: string;
  email: string;
  nim?: string;
  status: MembershipStatus;
  assignedAt?: string;
  assignedBy?: string;
}

export interface MembershipCandidate {
  uid: string;
  displayName: string;
  email: string;
  nim?: string;
  role: LaboratoryMemberRole;
}

export interface MembershipAssignInput {
  courseId: string;
  laboratoryId: string;
  memberUid: string;
  memberRole: LaboratoryMemberRole;
}

export interface MembershipImportInput {
  courseId: string;
  memberRole: LaboratoryMemberRole;
  rows: Array<{ laboratoryCode: string; email: string; nim?: string }>;
}

export interface MembershipTransferInput {
  membershipId: string;
  toLaboratoryId: string;
  expectedFromLaboratoryId: string;
}

export interface MembershipApiResult<T> {
  data: T;
  message?: string;
}
