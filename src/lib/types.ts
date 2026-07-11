// アプリ全体で使うデータの「形」の定義

export type MenuItem = {
  id: string;
  name: string; // 例: 腕立て伏せ
  count: number; // 例: 20
  unit: '回' | '秒';
};

export type WorkoutRecord = {
  id: string;
  date: string; // 達成した日 'YYYY-MM-DD'(端末のローカル時刻基準)
  completedAt: string; // 達成した瞬間(ISO文字列)
  photoFileName: string | null; // 端末内 photos/ フォルダのファイル名。写真なし記録は null
  menus: string[]; // 実施時点のメニュー内容(例: '腕立て伏せ 20回')
};

export type Settings = {
  notificationsEnabled: boolean;
  startHour: number; // 通知が来てよい時間帯の開始(0〜22)
  endHour: number; // 終了(1〜23)。startHour より大きいこと
};

// 日付キー('YYYY-MM-DD') → その日の通知予定時刻(ISO文字列)
// 「今日の通知が何時に鳴るか」はここに保存されるが、UIには表示しない(サプライズのため)
export type MissionPlan = Record<string, string>;
