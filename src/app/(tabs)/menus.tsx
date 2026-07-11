// メニュー画面: 通知が来たときにやる筋トレメニューを登録する

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadMenus, newId, saveMenus } from '@/lib/storage';
import type { MenuItem } from '@/lib/types';

// ワンタップで入力できる定番メニュー
const PRESETS: { name: string; count: number; unit: MenuItem['unit'] }[] = [
  { name: '腕立て伏せ', count: 10, unit: '回' },
  { name: 'スクワット', count: 15, unit: '回' },
  { name: '腹筋', count: 15, unit: '回' },
  { name: 'プランク', count: 30, unit: '秒' },
];

export default function MenusScreen() {
  const theme = useTheme();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [name, setName] = useState('');
  const [count, setCount] = useState(10);
  const [unit, setUnit] = useState<MenuItem['unit']>('回');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadMenus().then((loaded) => {
        if (active) setMenus(loaded);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = [...menus, { id: newId(), name: trimmed, count, unit }];
    setMenus(next);
    await saveMenus(next);
    setName('');
  };

  const remove = async (id: string) => {
    const next = menus.filter((m) => m.id !== id);
    setMenus(next);
    await saveMenus(next);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="subtitle">メニュー</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              通知が来たら、ここに登録した全メニューをこなします。
            </ThemedText>
          </View>

          {menus.length === 0 && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">まだメニューがありません</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                下の定番ボタンか入力欄から追加してください。最初は少なめが続けるコツ!
              </ThemedText>
            </ThemedView>
          )}

          {menus.map((menu) => (
            <ThemedView key={menu.id} type="backgroundElement" style={styles.menuRow}>
              <ThemedText type="smallBold" style={styles.menuName}>
                {menu.name} {menu.count}
                {menu.unit}
              </ThemedText>
              <Pressable onPress={() => remove(menu.id)} hitSlop={8}>
                <ThemedText type="small" themeColor="textSecondary">
                  削除
                </ThemedText>
              </Pressable>
            </ThemedView>
          ))}

          <View style={styles.presetRow}>
            {PRESETS.map((preset) => (
              <Pressable
                key={preset.name}
                onPress={() => {
                  setName(preset.name);
                  setCount(preset.count);
                  setUnit(preset.unit);
                }}
                style={[styles.presetChip, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small">{preset.name}</ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">メニューを追加</ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="種目名(例: 腕立て伏せ)"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.backgroundSelected },
              ]}
            />
            <View style={styles.countRow}>
              <Stepper
                value={count}
                onChange={setCount}
                min={5}
                max={300}
                step={5}
                suffix={unit}
              />
              <View style={styles.unitToggle}>
                {(['回', '秒'] as const).map((u) => (
                  <Pressable
                    key={u}
                    onPress={() => setUnit(u)}
                    style={[
                      styles.unitChip,
                      { backgroundColor: unit === u ? Accent : theme.backgroundSelected },
                    ]}>
                    <ThemedText type="small" style={unit === u ? styles.unitOn : undefined}>
                      {u}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
            <Button label="追加する" onPress={add} disabled={!name.trim()} />
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
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
  },
  menuName: {
    flex: 1,
    marginRight: Spacing.two,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  presetChip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  input: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitToggle: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  unitChip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  unitOn: {
    color: '#ffffff',
  },
});
