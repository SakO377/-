-- School Harness 初期スキーマ
-- 引き継ぎ文書 セクション5(データモデル ドラフト)に対応

CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
  api_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  capacity INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  grade TEXT,
  course TEXT,
  class_id TEXT REFERENCES classes(id),
  status TEXT NOT NULL DEFAULT '在籍' CHECK (status IN ('在籍', '休会', '退会')),
  tags TEXT NOT NULL DEFAULT '[]',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE guardians (
  id TEXT PRIMARY KEY,
  line_user_id TEXT UNIQUE,
  name TEXT,
  push_notifications_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE student_guardians (
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id TEXT NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  relation TEXT,
  PRIMARY KEY (student_id, guardian_id)
);

CREATE TABLE attendance_logs (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('check_in', 'check_out')),
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  notified_at TEXT
);

CREATE TABLE absence_requests (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES classes(id),
  date TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT '申請' CHECK (status IN ('申請', '振替提案', '確定')),
  makeup_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE report_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT,
  body_template TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  author TEXT,
  template_id TEXT REFERENCES report_templates(id),
  body TEXT NOT NULL,
  sent_at TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  segment TEXT NOT NULL DEFAULT '{}',
  scheduled_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE announcement_reads (
  announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  guardian_id TEXT NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (announcement_id, guardian_id)
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',
  total INTEGER NOT NULL DEFAULT 0,
  pdf_generated_at TEXT,
  sent_at TEXT,
  paid_status TEXT NOT NULL DEFAULT '未入金' CHECK (paid_status IN ('未入金', '入金済', '一部入金')),
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6.1 の「当月配信数カウンターと無料枠残量の表示」用ログ
CREATE TABLE line_message_log (
  id TEXT PRIMARY KEY,
  message_type TEXT NOT NULL CHECK (message_type IN ('push', 'reply', 'multicast')),
  purpose TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 1,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_students_class_id ON students(class_id);
CREATE INDEX idx_attendance_logs_student_id ON attendance_logs(student_id);
CREATE INDEX idx_absence_requests_student_id ON absence_requests(student_id);
CREATE INDEX idx_reports_student_id ON reports(student_id);
CREATE INDEX idx_invoices_student_id ON invoices(student_id);
CREATE INDEX idx_line_message_log_sent_at ON line_message_log(sent_at);
