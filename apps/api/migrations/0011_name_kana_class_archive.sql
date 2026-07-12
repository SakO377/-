-- 生徒の姓・名の分割とふりがな、クラスのアーカイブ(削除記録)

-- 生徒: 姓・名を分けて保持し、ふりがな(ひらがな)で検索できるようにする。
-- 表示用の name カラムは「姓 名」を結合したものを引き続き使う(既存の表示・帳票を壊さないため)。
ALTER TABLE students ADD COLUMN last_name TEXT;
ALTER TABLE students ADD COLUMN first_name TEXT;
ALTER TABLE students ADD COLUMN name_kana TEXT;

-- クラス: 物理削除せず archived_at を立てる(在籍生徒のFKを壊さず、削除記録として残す)。
ALTER TABLE classes ADD COLUMN archived_at TEXT;
