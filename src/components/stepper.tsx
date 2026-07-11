import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** 値の右に添える単位(例: '回' '時') */
  suffix?: string;
};

/** [-] 20回 [+] のような数値入力部品 */
export function Stepper({ value, onChange, min, max, step = 1, suffix = '' }: Props) {
  const theme = useTheme();

  const change = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) onChange(next);
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => change(-step)}
        disabled={value <= min}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.backgroundSelected },
          (pressed || value <= min) && styles.dim,
        ]}>
        <ThemedText type="smallBold">−</ThemedText>
      </Pressable>
      <ThemedText type="smallBold" style={styles.value}>
        {value}
        {suffix}
      </ThemedText>
      <Pressable
        onPress={() => change(step)}
        disabled={value >= max}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.backgroundSelected },
          (pressed || value >= max) && styles.dim,
        ]}>
        <ThemedText type="smallBold">＋</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    opacity: 0.5,
  },
  value: {
    minWidth: 56,
    textAlign: 'center',
    fontSize: 16,
  },
});
