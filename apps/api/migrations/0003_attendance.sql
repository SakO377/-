-- Step 5: 入退室管理用のQRトークンと、機能単位の設定を保存するapp_settings

ALTER TABLE students ADD COLUMN qr_token TEXT;
CREATE UNIQUE INDEX idx_students_qr_token ON students(qr_token) WHERE qr_token IS NOT NULL;

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
