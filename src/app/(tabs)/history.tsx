// きろく画面: 過去のミッション達成を新しい順に一覧する

import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { formatDateKey, formatTime } from '@/lib/date';
import { photoUri } from '@/lib/photos';
import { loadRecords } from '@/lib/storage';
import type { WorkoutRecord } from '@/lib/types';

export default function HistoryScreen() {
  const [records, setRecords] = useState<WorkoutRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadRecords().then((loaded) => {
        if (active) setRecords(loaded);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="subtitle">きろく</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                これまでの達成: {records.length}回
              </ThemedText>
            </View>
          }
          ListEmptyComponent={
            <ThemedView type="backgroundElement" style={styles.empty}>
              <ThemedText type="smallBold">まだ記録がありません</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                最初のミッションを達成すると、ここに証拠写真が並びます。
              </ThemedText>
            </ThemedView>
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.row}>
              {item.photoFileName ? (
                <Image
                  source={{ uri: photoUri(item.photoFileName) }}
                  style={styles.thumbnail}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <ThemedText>💪</ThemedText>
                </View>
              )}
              <View style={styles.rowText}>
                <ThemedText type="smallBold">
                  {formatDateKey(item.date)} {formatTime(item.completedAt)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                  {item.menus.join(' / ') || 'メニュー記録なし'}
                </ThemedText>
              </View>
            </ThemedView>
          )}
        />
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
  empty: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: Spacing.two,
    gap: Spacing.three,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  thumbnailPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
});
