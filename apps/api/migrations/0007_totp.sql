-- セキュリティ強化: スタッフの2段階認証(TOTP)

-- totp_secret: base32のシークレット(設定中/有効時に保持)。未設定はNULL。
-- totp_enabled: 1 のときログインでTOTPコードを要求する。
ALTER TABLE staff ADD COLUMN totp_secret TEXT;
ALTER TABLE staff ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
