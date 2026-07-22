-- 追加機能: 体験予約(見込み客)/ 成績 / 講師シフト / 紹介 と、欠席の「振替なし」対応

-- 体験・見学の予約受付(見込み客管理)。公開フォームからの申込も受け付ける。
CREATE TABLE trials (
  id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  guardian_name TEXT,
  contact TEXT,
  desired_date TEXT,
  class_id TEXT REFERENCES classes(id),
  status TEXT NOT NULL DEFAULT '問い合わせ'
    CHECK (status IN ('問い合わせ', '予約確定', '体験実施', '入会', '見送り')),
  note TEXT,
  reminder_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_trials_status ON trials(status);

-- 成績(点数)データ。生徒ごとにテスト結果などを記録する。
CREATE TABLE grades (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT,
  exam_name TEXT NOT NULL,
  date TEXT,
  score INTEGER,
  max_score INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_grades_student_id ON grades(student_id);

-- 講師のシフト(給与計算は対象外。勤務予定の共有・管理のみ)。
CREATE TABLE shifts (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_shifts_date ON shifts(date);

-- 口コミ・紹介キャンペーン管理。紹介元(在籍生徒)と紹介先の進捗・特典を追う。
CREATE TABLE referrals (
  id TEXT PRIMARY KEY,
  referrer_student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
  referrer_name TEXT,
  referee_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '紹介受付'
    CHECK (status IN ('紹介受付', '体験', '入会', '特典付与済', '見送り')),
  reward_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_referrals_status ON referrals(status);

-- 欠席連絡に「欠席のみ(振替なし)」を追加する。SQLiteはCHECK制約を後から
-- 変更できないため、テーブルを作り直して状態値を拡張する。
CREATE TABLE absence_requests_new (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES classes(id),
  date TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT '申請'
    CHECK (status IN ('申請', '振替提案', '確定', '欠席のみ')),
  makeup_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO absence_requests_new
  (id, student_id, class_id, date, reason, status, makeup_date, created_at)
  SELECT id, student_id, class_id, date, reason, status, makeup_date, created_at
  FROM absence_requests;
DROP TABLE absence_requests;
ALTER TABLE absence_requests_new RENAME TO absence_requests;
CREATE INDEX idx_absence_requests_student_id ON absence_requests(student_id);
