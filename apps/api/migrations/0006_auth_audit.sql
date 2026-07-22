-- セキュリティ強化: スタッフのパスワードログインと操作ログ(監査ログ)

-- パスワードログイン用のハッシュ。未設定(NULL)のスタッフは従来どおりAPIキーで運用できる。
ALTER TABLE staff ADD COLUMN password_hash TEXT;

-- 操作ログ。誰が・いつ・どの操作(更新系リクエスト)を行ったかを記録する。
-- staff_name は削除後も追えるよう非正規化して保存する。
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  staff_id TEXT,
  staff_name TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
