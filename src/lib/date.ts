// 日付まわりの小さな道具箱。
// 注意: new Date('2026-01-01') のような文字列パースはUTC扱いになり日本時間と1日ずれることが
// あるため、必ずここの関数を通してローカル時刻基準で扱う。

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Date → 'YYYY-MM-DD'(端末のローカル時刻基準) */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 'YYYY-MM-DD' → その日の0時のDate(ローカル時刻基準) */
export function dateKeyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** ISO文字列 → '18:04' のような時刻表示 */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${pad2(d.getMinutes())}`;
}

/** 'YYYY-MM-DD' → '7/11(土)' のような表示 */
export function formatDateKey(key: string): string {
  const d = dateKeyToDate(key);
  const week = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${week})`;
}
