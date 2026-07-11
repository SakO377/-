// 設定画面: 通知のON/OFF・通知が来てよい時間帯の設定・テスト通知

import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, BottomTabInset, Spacing } from '@/constants/theme';
import {
  countScheduledMissions,
  ensureNotificationPermission,
  rebuildMissionNotifications,
  sendTestNotification,
} from '@/lib/notifications';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/lib/storage';
import type { Settings } from '@/lib/types';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [testSent, setTestSent] = useState(false);
  const rebuildTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshCount = useCallback(async () => {
    setScheduledCount(await countScheduledMissions());
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const loaded = await loadSettings();
        if (!active) return;
        setSettings(loaded);
        await refreshCount();
      })();
      return () => {
        active = false;
      };
    }, [refreshCount]),
  );

  // 設定を保存し、少し待ってから通知予約を作り直す
  // (ステッパー連打のたびに作り直すと重いので、操作が落ち着くまで600ms待つ)
  const update = (patch: Partial<Settings>) => {
    let next = { ...settings, ...patch };
    if (next.startHour >= next.endHour) {
      // 開始と終了が逆転しないよう、動かした側に合わせてもう片方をずらす
      if (patch.startHour !== undefined) next = { ...next, endHour: next.startHour + 1 };
      else next = { ...next, startHour: next.endHour - 1 };
    }
    setSettings(next);
    saveSettings(next);

    if (rebuildTimer.current) clearTimeout(rebuildTimer.current);
    rebuildTimer.current = setTimeout(async () => {
      if (next.notificationsEnabled) await ensureNotificationPermission();
      await rebuildMissionNotifications();
      await refreshCount();
    }, 600);
  };

  const sendTest = async () => {
    const granted = await ensureNotificationPermission();
    if (!granted) return;
    await sendTestNotification();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 8000);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="subtitle">設定</ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.switchRow}>
              <ThemedText type="smallBold">ランダム通知</ThemedText>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={(v) => update({ notificationsEnabled: v })}
                trackColor={{ true: Accent }}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              1日1回、下の時間帯のどこかでランダムに通知が鳴ります。時刻は毎日抽選され、事前には見えません。
            </ThemedText>
          </ThemedView>

          {settings.notificationsEnabled && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">通知が来てよい時間帯</ThemedText>
              <View style={styles.hourRow}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.hourLabel}>
                  開始
                </ThemedText>
                <Stepper
                  value={settings.startHour}
                  onChange={(v) => update({ startHour: v })}
                  min={0}
                  max={22}
                  suffix="時"
                />
              </View>
              <View style={styles.hourRow}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.hourLabel}>
                  終了
                </ThemedText>
                <Stepper
                  value={settings.endHour}
                  onChange={(v) => update({ endHour: v })}
                  min={1}
                  max={23}
                  suffix="時"
                />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                現在の予約: {scheduledCount}日分 / 時間帯を変えると時刻は再抽選されます
              </ThemedText>
            </ThemedView>
          )}

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">動作テスト</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              5秒後にテスト通知が届きます。ボタンを押したらホーム画面に戻って待ってみてください。
            </ThemedText>
            <Button
              label={testSent ? '5秒後に届きます…' : 'テスト通知を送る'}
              variant="secondary"
              onPress={sendTest}
              disabled={testSent}
            />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">このアプリについて</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              KinReal(キンリアル)は「ランダムな時刻の通知が鳴った瞬間に筋トレする」アプリです。
              データはすべてこのiPhoneの中にだけ保存されます。
              Expo Goで動かしている間は、通知の差出人が「Expo Go」と表示されます。
            </ThemedText>
          </ThemedView>
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
    gap: Spacing.two,
  },
  header: {
    marginBottom: Spacing.two,
  },
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hourLabel: {
    width: 48,
  },
});
