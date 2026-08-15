import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

type Props = PropsWithChildren<{
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}>;

export function ActionButton({ children, onPress, variant = 'primary', disabled, loading, style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={variant === 'secondary' ? '#0B5CD6' : '#FFFFFF'} /> : null}
      <Text style={[styles.text, variant === 'secondary' && styles.secondaryText]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primary: { backgroundColor: '#0B5CD6' },
  secondary: { backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: '#BCD3F7' },
  danger: { backgroundColor: '#C93434' },
  text: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryText: { color: '#0B4AA5' },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.88 },
});
