// ランダム通知の心臓部。
//
// 仕組み: サーバーは使わず、iOSの「ローカル通知」(端末が自分で鳴らす予約通知)を使う。
// アプリを開くたびに syncMissionNotifications() が呼ばれ、今日から7日分の
// 「ランダムな通知時刻」を抽選してOSに予約する。一度決めた時刻は変えない
// (開くたびに時刻が変わるとサプライズにならないため)。

import * as Notifications from 'expo-notifications';

import { addDays, dateKeyToDate, toDateKey } from './date';
import { loadPlan, loadRecords, loadSettings, savePlan } from './storage';
import type { MissionPlan, Settings } from './types';

const MISSION_ID_PREFIX = 'mission-';

// iOSはローカル通知の予約が64件までなので、先の予約は7日分にとどめる
const PLAN_DAYS = 7;

/** アプリを開いている最中でも通知バナーを表示するための設定(起動時に1回呼ぶ) */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** 通知の許可を取る。すでに拒否されていて再質問できない場合は false */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

/** 指定日の通知時間帯の中からランダムな時刻を1つ選ぶ。窓が既に過ぎていたら null */
function randomTimeInWindow(dateKey: string, settings: Settings, notBefore?: Date): Date | null {
  const day = dateKeyToDate(dateKey);
  const start = new Date(day);
  start.setHours(settings.startHour, 0, 0, 0);
  const end = new Date(day);
  end.setHours(settings.endHour, 0, 0, 0);

  const min = notBefore && notBefore > start ? notBefore : start;
  if (min.getTime() >= end.getTime()) return null;

  const t = min.getTime() + Math.random() * (end.getTime() - min.getTime());
  return new Date(t);
}

function missionContent(test = false) {
  return {
    title: test ? '🔥 KinRealタイム!(テスト)' : '🔥 KinRealタイム!',
    body: test
      ? '本番ではこんな通知がランダムな時刻に届きます💪'
      : '今この瞬間が筋トレの時間。メニューをこなして証拠を撮ろう💪',
    sound: 'default' as const,
    data: { url: '/workout' },
  };
}

/**
 * 通知予定表(plan)とOSへの予約を現在の設定に合わせて同期する。
 * アプリ起動時・ホーム画面を開いた時に呼ばれる。何度呼んでも安全(冪等)。
 */
export async function syncMissionNotifications(): Promise<MissionPlan> {
  const settings = await loadSettings();
  const now = new Date();
  const todayKey = toDateKey(now);

  if (!settings.notificationsEnabled) {
    await cancelAllMissionNotifications();
    await savePlan({});
    return {};
  }

  // 過去日の予定を捨て、未来の予定は変えずに引き継ぐ
  const previous = await loadPlan();
  const plan: MissionPlan = {};
  for (const [key, time] of Object.entries(previous)) {
    if (key >= todayKey) plan[key] = time;
  }

  // 今日から7日分、予定のない日にランダム時刻を抽選する
  for (let i = 0; i < PLAN_DAYS; i++) {
    const key = toDateKey(addDays(now, i));
    if (plan[key]) continue;
    const time = randomTimeInWindow(
      key,
      settings,
      // 今日の分は「今から10分後以降」から抽選(直後すぎる通知を避ける)
      i === 0 ? new Date(now.getTime() + 10 * 60 * 1000) : undefined,
    );
    if (time) plan[key] = time.toISOString();
  }
  await savePlan(plan);

  // 今日すでに達成済みなら、今日の通知はもう鳴らさない
  const records = await loadRecords();
  const doneToday = records.some((r) => r.date === todayKey);

  const wanted = new Map<string, Date>();
  for (const [key, iso] of Object.entries(plan)) {
    const time = new Date(iso);
    if (time <= now) continue;
    if (key === todayKey && doneToday) continue;
    wanted.set(MISSION_ID_PREFIX + key, time);
  }

  // OSの予約一覧と突き合わせ: 不要な予約は消し、足りない予約だけ追加する
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const item of scheduled) {
    if (!item.identifier.startsWith(MISSION_ID_PREFIX)) continue;
    if (wanted.has(item.identifier)) {
      wanted.delete(item.identifier);
    } else {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  }
  for (const [identifier, date] of wanted) {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: missionContent(),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }

  return plan;
}

export async function cancelAllMissionNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const item of scheduled) {
    if (item.identifier.startsWith(MISSION_ID_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  }
}

/** 設定変更時に呼ぶ: 予定を全部捨てて抽選し直す */
export async function rebuildMissionNotifications(): Promise<MissionPlan> {
  await cancelAllMissionNotifications();
  await savePlan({});
  return syncMissionNotifications();
}

/** ミッション達成時に呼ぶ: 今日の(まだ鳴っていない)通知を取り消す */
export async function cancelTodayMissionNotification(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(MISSION_ID_PREFIX + toDateKey(new Date()));
}

/** 予約済みのミッション通知の件数(設定画面の表示用) */
export async function countScheduledMissions(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter((i) => i.identifier.startsWith(MISSION_ID_PREFIX)).length;
}

/** 5秒後に届くテスト通知(設定画面から動作確認に使う) */
export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: missionContent(true),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
    },
  });
}
