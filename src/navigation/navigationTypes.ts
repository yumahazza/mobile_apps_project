/**
 * Navigation Types
 * SRS-INF-001: Clean navigation architecture for Assistant and Student flows
 */

export interface NavigationProp {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  currentScreen: string;
  params?: any;
}

export type AssistantScreenName =
  | 'AssistantHome'
  | 'SessionRecap'
  | 'ScheduleList'
  | 'Profile'
  | 'SessionDetail'
  | 'SessionControl'
  | 'StudentList'
  | 'AttendanceDetail'
  | 'AttendanceStats'
  | 'LeaveApproval'
  | 'LaboratoryManagement'
  | 'Notifications';
  | 'Notifications'
  | 'LaboratoryMap';

export type StudentScreenName =
  | 'StudentHome'
  | 'ScheduleList'
  | 'StudentHistory'
  | 'LeaveRequest'
  | 'Profile'
  | 'SessionDetail'
  | 'AttendanceDetail'
  | 'Notifications'
  | 'LaboratoryMap'
  | 'StudentAttendance';
