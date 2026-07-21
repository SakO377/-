-- 案A: 振込報告フロー。保護者が「振り込みました」と報告した記録を持つ。
-- paid_status の CHECK は変えず、報告時刻を別カラムで持つことで
-- 「入金確認待ち」= 未入金 かつ payment_reported_at あり、として表現する。
ALTER TABLE invoices ADD COLUMN payment_reported_at TEXT;
ALTER TABLE invoices ADD COLUMN payment_report_note TEXT;
