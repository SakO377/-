-- Step 7: 生徒ごとの月謝(基準額)。実際の請求内訳(兄弟割引など)は
-- invoices.items で都度手動調整する。
ALTER TABLE students ADD COLUMN monthly_fee INTEGER;
