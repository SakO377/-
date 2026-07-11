import { addDays, dateKeyToDate, toDateKey } from './date';
import type { WorkoutRecord } from './types';

/**
 * ストリーク(連続達成日数)を数える。
 * 今日達成済みなら今日から、まだなら昨日から過去へ遡り、記録が途切れるまで数える。
 * (今日まだやっていなくても、昨日まで続いていればストリークは生きている扱い)
 */
export function calcStreak(records: WorkoutRecord[], today: string): number {
  const days = new Set(records.map((r) => r.date));
  let cursor = days.has(today) ? dateKeyToDate(today) : addDays(dateKeyToDate(today), -1);
  let streak = 0;
  while (days.has(toDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
