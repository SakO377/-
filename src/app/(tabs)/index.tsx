// ホーム画面: ストリーク(連続達成日数)と「今日のミッション」の状態を表示する

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, BottomTabInset, Spacing } from '@/constants/theme';
import { formatTime, toDateKey } from '@/lib/date';
import {
  ensureNotificationPermission,
  syncMissionNotifications,
} from '@/lib/notifications';
import { loadMenus, loadRecords, loadSettings } from '@/lib/storage';
import { calcStreak } from '@/lib/streak';
import type { MenuItem, MissionPlan, Settings, WorkoutRecord } from '@/lib/types';

type MissionStatus = 'waiting' | 'live' | 'done' | 'none';

export default function HomeScreen() {
  const router = useRouter();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [records, setRecords] = useState<WorkoutRecord[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [plan, setPlan] = useState<MissionPlan>({});
  const [permissionOk, setPermissionOk] = useState(true);
  const [now, setNow] = useState(new Date());

  // 画面を開くたびにデータを読み直し、通知の予約も同期する
  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        const [loadedMenus, loadedRecords, loadedSettings] = await Promise.all([
          loadMenus(),
          loadRecords(),
          loadSettings(),
        ]);
        if (!active) return;
        setMenus(loadedMenus);
        setRecords(loadedRecords);
        setSettings(loadedSettings);
        setNow(new Date());

        if (loadedSettings.notificationsEnabled) {
          const granted = await ensureNotificationPermission();
          if (!active) return;
          setPermissionOk(granted);
        }
        const syncedPlan = await syncMissionNotifications();
        if (!active) return;
        setPlan(syncedPlan);
      })();

      // 画面を開いたままでも「通知時刻が来た」ことに気づけるよう、15秒ごとに時計を進める
      const timer = setInterval(() => setNow(new Date()), 15 * 1000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, []),
  );

  const todayKey = toDateKey(now);
  const todayRecord = records.find((r) => r.date === todayKey);
  const todayPlanIso = plan[todayKey];
  const streak = calcStreak(records, todayKey);

  let status: MissionStatus = 'none';
  if (todayRecord) {
    status = 'done';
  } else if (todayPlanIso) {
    status = new Date(todayPlanIso) <= now ? 'live' : 'waiting';
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="subtitle">KinReal</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              通知が鳴ったら、その瞬間に筋トレ。
            </ThemedText>
          </View>

          <View style={styles.streakBox}>
            <ThemedText style={styles.streakFlame}>🔥</ThemedText>
            <ThemedText type="title" style={styles.streakNumber}>
              {streak}
            </ThemedText>
            <ThemedText type="smallBold" themeColor="textSecondary">
              日連続
            </ThemedText>
            {streak === 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                今日やれば火がつく!
              </ThemedText>
            )}
          </View>

          {status === 'live' && (
            <View style={[styles.card, styles.liveCard]}>
              <ThemedText type="subtitle" style={styles.liveTitle}>
                🚨 ミッション発動中!
              </ThemedText>
              <ThemedText type="small" style={styles.liveText}>
                {formatTime(todayPlanIso!)} に通知が鳴った。今すぐやろう!
              </ThemedText>
              <Button
                label="ミッション開始 💪"
                onPress={() => router.push('/workout')}
                style={styles.liveButton}
                labelStyle={styles.liveButtonLabel}
              />
            </View>
          )}

          {status === 'waiting' && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">🔔 今日のミッションはこのあと…</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                今日のどこかで突然通知が鳴る。時刻はヒミツ。
              </ThemedText>
            </ThemedView>
          )}

          {status === 'done' && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">✅ 今日のミッション達成!</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatTime(todayRecord!.completedAt)} に完了。また明日!
              </ThemedText>
            </ThemedView>
          )}

          {status === 'none' && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">今日の通知予定はありません</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {settings?.notificationsEnabled
                  ? '今日の通知時間帯はもう過ぎたみたい。それでも筋トレはできる💪'
                  : '通知がOFFになっています。設定タブからONにできます。'}
              </ThemedText>
            </ThemedView>
          )}

          {!permissionOk && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">⚠️ 通知が許可されていません</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                iPhoneの「設定 → 通知 → Expo Go」で通知を許可してください。
              </ThemedText>
            </ThemedView>
          )}

          {menus.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">まずは筋トレメニューを登録しよう</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                通知が来たときに何をやるかを先に決めておきます。
              </ThemedText>
              <Button
                label="メニューを登録する"
                variant="secondary"
                onPress={() => router.push('/menus')}
                style={styles.cardButton}
              />
            </ThemedView>
          ) : (
            status !== 'live' &&
            status !== 'done' && (
              <Button
                label="通知を待たずにやる(フライングOK)"
                variant="secondary"
                onPress={() => router.push('/workout')}
              />
            )
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.one,
  },
  streakBox: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.one,
  },
  streakFlame: {
    fontSize: 56,
    lineHeight: 64,
  },
  streakNumber: {
    fontSize: 72,
    lineHeight: 80,
  },
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardButton: {
    marginTop: Spacing.one,
  },
  liveCard: {
    backgroundColor: Accent,
  },
  liveTitle: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 32,
  },
  liveText: {
    color: '#ffffff',
  },
  liveButton: {
    backgroundColor: '#ffffff',
  },
  liveButtonLabel: {
    color: Accent,
  },
});
