-- 振替の「空き枠から自分で選ぶ」方式に対応するため、選択したクラスを記録する列を追加する。
ALTER TABLE absence_requests ADD COLUMN makeup_class_id TEXT REFERENCES classes(id);
