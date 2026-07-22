-- 生徒の入会日・退会日を記録する。
ALTER TABLE students ADD COLUMN enrolled_at TEXT;
ALTER TABLE students ADD COLUMN withdrawn_at TEXT;

-- 既存データは登録日(created_at)を入会日として補完する。
UPDATE students SET enrolled_at = date(created_at) WHERE enrolled_at IS NULL;
