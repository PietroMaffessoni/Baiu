import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { T } from '@/theme/text';
import { color, radius } from '@/theme/tokens';
import { Icon, type IconName } from './icon';

type Props = {
  label: string;
  onPress?: () => void;
  kind?: 'primary' | 'secondary' | 'quiet' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

export function Button({ label, onPress, kind = 'primary', icon, disabled, loading, style, accessibilityHint }: Props) {
  const fg =
    kind === 'primary'
      ? color.night
      : kind === 'danger'
        ? color.vermilion
        : kind === 'secondary'
          ? color.paper
          : color.lantern;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: false }}
      style={({ pressed }) => [
        styles.base,
        styles[kind],
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}>
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : icon ? (
          <Icon name={icon} size={18} tint={fg} weight="semibold" />
        ) : null}
        <T variant="bodyStrong" style={{ color: fg }}>
          {label}
        </T>
      </View>
    </Pressable>
  );
}

/** Botão redondo de ícone, 44pt, para barras de topo. */
export function IconButton({
  icon,
  label,
  onPress,
  tint = color.paper,
  children,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  tint?: string;
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: color.plateHi }]}>
      <Icon name={icon} size={19} tint={tint} />
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: { backgroundColor: color.lantern },
  secondary: { backgroundColor: color.plate, borderWidth: StyleSheet.hairlineWidth, borderColor: color.lineStrong },
  quiet: { backgroundColor: 'transparent', minHeight: 44, paddingHorizontal: 12 },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(242, 87, 60, 0.45)' },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.4 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
});
