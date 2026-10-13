import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { brlParts } from '@/lib/money';
import { color, font, gutter } from '@/theme/tokens';
import { Icon } from './icon';

const MAX_CENTS = 9_999_999_999; // R$ 99.999.999,99

export const tick = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

/** Valor digitado em centavos, como nos apps de banco: os dígitos entram pela direita. */
export function useCents(initial = 0) {
  const [cents, setCents] = useState(Math.max(0, Math.round(initial)));
  return {
    cents,
    setCents,
    digit: (d: number) => setCents((c) => (c * 10 + d > MAX_CENTS ? c : c * 10 + d)),
    double: () => setCents((c) => (c * 100 > MAX_CENTS ? c : c * 100)),
    back: () => setCents((c) => Math.floor(c / 10)),
  };
}

export function AmountDisplay({ cents, size = 52, negative }: { cents: number; size?: number; negative?: boolean }) {
  const p = brlParts(cents / 100);
  const empty = cents === 0;
  const small = Math.round(size * 0.42);
  return (
    <View style={styles.amount} accessible accessibilityLabel={`${p.int} reais e ${p.cents} centavos`}>
      <Text allowFontScaling={false} style={[styles.amountSmall, { fontSize: small, color: color.ink2 }]}>
        {negative ? '−R$' : 'R$'}
      </Text>
      <Text
        allowFontScaling={false}
        adjustsFontSizeToFit
        numberOfLines={1}
        style={[styles.amountInt, { fontSize: size, lineHeight: size * 1.23 }, empty && { color: color.ink3 }]}>
        {p.int}
      </Text>
      <Text
        allowFontScaling={false}
        style={[styles.amountSmall, { fontSize: small, color: empty ? color.ink3 : color.ink2 }]}>
        ,{p.cents}
      </Text>
    </View>
  );
}

export function Keypad({
  onDigit,
  onDouble,
  onBack,
}: {
  onDigit: (d: number) => void;
  onDouble: () => void;
  onBack: () => void;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'];
  return (
    <View style={styles.keypad}>
      {keys.map((k) => (
        <Pressable
          key={k}
          onPress={() => {
            tick();
            if (k === 'back') onBack();
            else if (k === '00') onDouble();
            else onDigit(Number(k));
          }}
          style={({ pressed }) => [styles.key, pressed && { backgroundColor: color.plate }]}
          accessibilityRole="button"
          accessibilityLabel={k === 'back' ? 'Apagar' : k}>
          {k === 'back' ? (
            <Icon name="backspace" size={22} tint={color.ink2} />
          ) : (
            <Text allowFontScaling={false} style={styles.keyText}>
              {k}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  amount: { flexDirection: 'row', alignItems: 'baseline', marginTop: 22 },
  amountSmall: { fontFamily: font.bold, marginRight: 4 },
  amountInt: { fontFamily: font.black, color: color.paper, letterSpacing: -1, flexShrink: 1 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: gutter - 6, marginTop: 16 },
  key: { width: '33.333%', height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  keyText: { fontFamily: font.bold, fontSize: 26, color: color.paper },
});
