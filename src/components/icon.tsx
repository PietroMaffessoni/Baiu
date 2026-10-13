import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { color } from '@/theme/tokens';

/** SF Symbols no iPhone, Material Symbols no Android e na web. */
const ICONS = {
  home: { ios: 'house', android: 'house' },
  bank: { ios: 'building.columns', android: 'account_balance' },
  card: { ios: 'creditcard', android: 'credit_card' },
  vault: { ios: 'lock.shield', android: 'savings' },
  growth: { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up' },
  income: { ios: 'arrow.down.left', android: 'south_west' },
  outcome: { ios: 'arrow.up.right', android: 'north_east' },
  basket: { ios: 'basket', android: 'shopping_basket' },
  food: { ios: 'fork.knife', android: 'restaurant' },
  car: { ios: 'car', android: 'directions_car' },
  health: { ios: 'heart', android: 'favorite' },
  repeat: { ios: 'arrow.triangle.2.circlepath', android: 'autorenew' },
  bag: { ios: 'bag', android: 'shopping_bag' },
  ticket: { ios: 'ticket', android: 'confirmation_number' },
  eye: { ios: 'eye', android: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off' },
  settings: { ios: 'slider.horizontal.3', android: 'tune' },
  seal: { ios: 'seal', android: 'workspace_premium' },
  plus: { ios: 'plus', android: 'add' },
  close: { ios: 'xmark', android: 'close' },
  chevron: { ios: 'chevron.right', android: 'chevron_right' },
  back: { ios: 'chevron.left', android: 'chevron_left' },
  search: { ios: 'magnifyingglass', android: 'search' },
  check: { ios: 'checkmark', android: 'check' },
  info: { ios: 'info.circle', android: 'info' },
  trash: { ios: 'trash', android: 'delete' },
  calendar: { ios: 'calendar', android: 'calendar_today' },
  lock: { ios: 'lock', android: 'lock' },
  link: { ios: 'link', android: 'link' },
  backspace: { ios: 'delete.left', android: 'backspace' },
  bolt: { ios: 'bolt', android: 'bolt' },
} as const satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  tint?: ColorValue;
  weight?: 'regular' | 'medium' | 'semibold';
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 20, tint = color.paper, weight = 'medium', style }: Props) {
  const n = ICONS[name];
  return (
    <SymbolView
      name={{ ios: n.ios, android: n.android, web: n.android }}
      size={size}
      tintColor={tint}
      weight={weight}
      resizeMode="scaleAspectFit"
      style={[{ width: size, height: size }, style]}
    />
  );
}
