// データの保存と読み出し。
// すべて端末内の AsyncStorage(キーと値を保存できる小さな倉庫)に入る。
// サーバーには何も送らないので、アプリを消すとデータも消える。

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MenuItem, MissionPlan, Settings, WorkoutRecord } from './types';

const KEYS = {
  menus: 'kinreal:menus',
  settings: 'kinreal:settings',
  records: 'kinreal:records',
  plan: 'kinreal:plan',
} as const;

export const DEFAULT_SETTINGS: Settings = {
  notificationsEnabled: true,
  startHour: 8,
  endHour: 22,
};

async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function saveJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const loadMenus = () => loadJson<MenuItem[]>(KEYS.menus, []);
export const saveMenus = (menus: MenuItem[]) => saveJson(KEYS.menus, menus);

export const loadSettings = () => loadJson<Settings>(KEYS.settings, DEFAULT_SETTINGS);
export const saveSettings = (settings: Settings) => saveJson(KEYS.settings, settings);

export const loadRecords = () => loadJson<WorkoutRecord[]>(KEYS.records, []);

/** 記録を先頭に追加して、追加後の全記録を返す */
export async function addRecord(record: WorkoutRecord): Promise<WorkoutRecord[]> {
  const records = await loadRecords();
  const next = [record, ...records];
  await saveJson(KEYS.records, next);
  return next;
}

export const loadPlan = () => loadJson<MissionPlan>(KEYS.plan, {});
export const savePlan = (plan: MissionPlan) => saveJson(KEYS.plan, plan);

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
