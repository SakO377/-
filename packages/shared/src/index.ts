// School Harness で admin / api / liff が共有する型定義と定数

/** LINE Messaging API の無料メッセージ枠(Push通知、月あたり) */
export const LINE_FREE_PUSH_QUOTA = 200;

export type StaffRole = "owner" | "admin" | "staff";
export type StudentStatus = "在籍" | "休会" | "退会";
export type AttendanceType = "check_in" | "check_out";
export type AbsenceStatus = "申請" | "振替提案" | "確定";
export type PaidStatus = "未入金" | "入金済" | "一部入金";
export type LineMessageType = "push" | "reply" | "multicast";

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  api_key: string;
  created_at: string;
}

export interface ClassEntity {
  id: string;
  name: string;
  weekday: number; // 0 (日) - 6 (土)
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  capacity: number | null;
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  grade: string | null;
  course: string | null;
  class_id: string | null;
  status: StudentStatus;
  tags: string[];
  metadata: Record<string, unknown>;
  monthly_fee: number | null;
  created_at: string;
}

export interface Guardian {
  id: string;
  line_user_id: string | null;
  name: string | null;
  push_notifications_enabled: boolean;
  created_at: string;
}

export interface StudentGuardian {
  student_id: string;
  guardian_id: string;
  relation: string | null;
}

export interface AttendanceLog {
  id: string;
  student_id: string;
  type: AttendanceType;
  timestamp: string;
  notified_at: string | null;
}

export interface AbsenceRequest {
  id: string;
  student_id: string;
  class_id: string | null;
  date: string;
  reason: string | null;
  status: AbsenceStatus;
  makeup_date: string | null;
  created_at: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  subject: string | null;
  body_template: string;
  created_at: string;
}

export interface Report {
  id: string;
  student_id: string;
  author: string | null;
  template_id: string | null;
  body: string;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  segment: Record<string, unknown>;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface AnnouncementRead {
  announcement_id: string;
  guardian_id: string;
  read_at: string;
}

export interface Invoice {
  id: string;
  student_id: string;
  year_month: string; // "YYYY-MM"
  items: Array<{ label: string; amount: number }>;
  total: number;
  pdf_generated_at: string | null;
  sent_at: string | null;
  paid_status: PaidStatus;
  paid_at: string | null;
  created_at: string;
}

export interface LineMessageLogEntry {
  id: string;
  message_type: LineMessageType;
  purpose: string;
  recipient_count: number;
  sent_at: string;
}
