-- Step 3: 保護者のLINE連携用の招待コード
CREATE TABLE invite_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by_guardian_id TEXT REFERENCES guardians(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_invite_codes_student_id ON invite_codes(student_id);
