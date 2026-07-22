-- 2段階認証のリカバリーコード(端末紛失時の復旧手段)。
-- 高エントロピーな乱数のため、SHA-256でハッシュ化して保存する。1回使うと used_at が入る。
CREATE TABLE recovery_codes (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_recovery_codes_staff_id ON recovery_codes(staff_id);
