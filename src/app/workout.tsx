// ミッション実行画面。
// チェックリストで筋トレをこなす → カメラで証拠を撮る → 記録してストリーク更新、の一本道。

import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Spacing } from '@/constants/theme';
import { toDateKey } from '@/lib/date';
import { cancelTodayMissionNotification, syncMissionNotifications } from '@/lib/notifications';
import { persistPhoto } from '@/lib/photos';
import { addRecord, loadMenus, newId } from '@/lib/storage';
import { calcStreak } from '@/lib/streak';
import { useTheme } from '@/hooks/use-theme';
import type { MenuItem } from '@/lib/types';

type Step = 'checklist' | 'camera' | 'preview' | 'done';

export default function WorkoutScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [step, setStep] = useState<Step>('checklist');
  const [menus, setMenus] = useState<MenuItem[] | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [photo, setPhoto] = useState<CameraCapturedPicture | null>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [saving, setSaving] = useState(false);
  const [newStreak, setNewStreak] = useState(0);

  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    loadMenus().then(setMenus);
  }, []);

  const allChecked = menus !== null && menus.length > 0 && menus.every((m) => checked[m.id]);

  const goToCamera = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        setStep('camera'); // 許可されなくても画面は進め、案内を表示する
        return;
      }
    }
    setStep('camera');
  };

  const takePicture = async () => {
    const picture = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
    if (picture) {
      setPhoto(picture);
      setStep('preview');
    }
  };

  const save = async (withPhoto: boolean) => {
    if (saving || menus === null) return;
    setSaving(true);
    try {
      const fileName = withPhoto && photo ? await persistPhoto(photo.uri) : null;
      const doneMenus = menus.filter((m) => checked[m.id]).map((m) => `${m.name} ${m.count}${m.unit}`);
      const today = toDateKey(new Date());
      const records = await addRecord({
        id: newId(),
        date: today,
        completedAt: new Date().toISOString(),
        photoFileName: fileName,
        menus: doneMenus,
      });
      // 今日の分の通知はもう不要なので取り消し、明日以降の予約を整える
      await cancelTodayMissionNotification();
      await syncMissionNotifications();
      setNewStreak(calcStreak(records, today));
      setStep('done');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* 閉じるボタン(完了画面では非表示) */}
        {step !== 'done' && (
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.back()}
              style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">✕</ThemedText>
            </Pressable>
          </View>
        )}

        {step === 'checklist' && menus !== null && (
          <View style={styles.body}>
            <ThemedText type="subtitle">今日のミッション</ThemedText>
            {menus.length === 0 ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  メニューがまだ登録されていません。先に「メニュー」タブで登録してください。
                </ThemedText>
                <Button label="閉じる" variant="secondary" onPress={() => router.back()} />
              </>
            ) : (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  全部こなしたらチェックを入れて、証拠の撮影へ!
                </ThemedText>
                <View style={styles.list}>
                  {menus.map((menu) => {
                    const isOn = !!checked[menu.id];
                    return (
                      <Pressable
                        key={menu.id}
                        onPress={() => setChecked((prev) => ({ ...prev, [menu.id]: !isOn }))}
                        style={[
                          styles.checkRow,
                          { backgroundColor: isOn ? Accent : theme.backgroundElement },
                        ]}>
                        <ThemedText type="smallBold" style={isOn ? styles.checkTextOn : undefined}>
                          {isOn ? '✓ ' : '　'}
                          {menu.name} {menu.count}
                          {menu.unit}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                <Button
                  label={allChecked ? '証拠を撮影する 📸' : '全部やったらチェック!'}
                  disabled={!allChecked}
                  onPress={goToCamera}
                />
              </>
            )}
          </View>
        )}

        {step === 'camera' &&
          (cameraPermission?.granted ? (
            <View style={styles.body}>
              <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
              <View style={styles.cameraControls}>
                <Button
                  label="🔄 前後切替"
                  variant="secondary"
                  onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
                  style={styles.cameraSub}
                />
                <Button label="📸 撮影!" onPress={takePicture} style={styles.cameraMain} />
              </View>
            </View>
          ) : (
            <View style={styles.body}>
              <ThemedText type="subtitle">カメラが使えません</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                iPhoneの「設定 → プライバシー → カメラ → Expo Go」で許可してください。
              </ThemedText>
              <Button label="もう一度許可を求める" variant="secondary" onPress={goToCamera} />
              <Button
                label="写真なしで記録する"
                variant="secondary"
                onPress={() => save(false)}
                disabled={saving}
              />
            </View>
          ))}

        {step === 'preview' && photo && (
          <View style={styles.body}>
            <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" />
            <View style={styles.cameraControls}>
              <Button
                label="撮り直す"
                variant="secondary"
                onPress={() => setStep('camera')}
                style={styles.cameraSub}
              />
              <Button
                label={saving ? '記録中…' : 'これで記録する 💪'}
                onPress={() => save(true)}
                disabled={saving}
                style={styles.cameraMain}
              />
            </View>
          </View>
        )}

        {step === 'done' && (
          <View style={[styles.body, styles.doneBody]}>
            <ThemedText style={styles.doneEmoji}>🎉</ThemedText>
            <ThemedText type="title" style={styles.doneStreak}>
              🔥 {newStreak}日連続
            </ThemedText>
            <ThemedText type="smallBold">ミッション達成!ナイスファイト!</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              記録は「きろく」タブでいつでも見返せます。
            </ThemedText>
            <Button label="ホームへ戻る" onPress={() => router.back()} style={styles.doneButton} />
          </View>
        )}
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
  checkRow: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
  },
  checkTextOn: {
    color: '#ffffff',
  },
  camera: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  preview: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cameraControls: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  cameraSub: {
    flex: 1,
  },
  cameraMain: {
    flex: 2,
  },
  doneBody: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneEmoji: {
    fontSize: 64,
    lineHeight: 72,
  },
  doneStreak: {
    fontSize: 40,
    lineHeight: 48,
  },
  doneButton: {
    alignSelf: 'stretch',
    marginTop: Spacing.three,
  },
});
