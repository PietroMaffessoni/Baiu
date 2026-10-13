import { StyleSheet, Text, View } from 'react-native';

import { useStore } from '@/store/store';
import { brl, brlParts, HIDDEN } from '@/lib/money';
import { T, type Variant } from '@/theme/text';
import { color, font } from '@/theme/tokens';

type Props = {
  value: number;
  variant?: Variant;
  tone?: 'paper' | 'ink2' | 'ink3' | 'jade' | 'vermilion' | 'lantern';
  sign?: 'auto' | 'always' | 'never';
  /** Entradas ficam em jade automaticamente. */
  colorize?: boolean;
  align?: 'left' | 'right' | 'center';
};

/** Valor em reais que respeita o modo privado. */
export function Money({ value, variant = 'body', tone = 'paper', sign = 'auto', colorize, align }: Props) {
  const { state } = useStore();
  const text = state.settings.hideValues ? HIDDEN : brl(value, { sign });
  const finalTone = colorize && value > 0 && !state.settings.hideValues ? 'jade' : tone;
  return (
    <T
      variant={variant}
      tone={finalTone}
      tabular
      align={align}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}>
      {text}
    </T>
  );
}

/** O número grande: R$ pequeno, inteiro em destaque e centavos rebaixados. */
export function BigMoney({
  value,
  size = 44,
  accessibilityLabel,
}: {
  value: number;
  size?: number;
  accessibilityLabel?: string;
}) {
  const { state } = useStore();
  const p = brlParts(value);
  const small = Math.round(size * 0.42);
  const line = Math.round(size * 1.22);

  if (state.settings.hideValues) {
    return (
      <View style={styles.row} accessibilityLabel="Valores ocultos">
        <Text allowFontScaling={false} style={[styles.currency, { fontSize: small, lineHeight: line }]}>
          R$
        </Text>
        <Text allowFontScaling={false} style={[styles.int, { fontSize: size, lineHeight: line, color: color.ink3 }]}>
          ••••••
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row} accessible accessibilityLabel={accessibilityLabel ?? brl(value)}>
      <Text allowFontScaling={false} style={[styles.currency, { fontSize: small, lineHeight: line }]}>
        {p.negative ? '−R$' : 'R$'}
      </Text>
      <Text allowFontScaling={false} style={[styles.int, { fontSize: size, lineHeight: line }]}>
        {p.int}
      </Text>
      <Text allowFontScaling={false} style={[styles.cents, { fontSize: small, lineHeight: line }]}>
        ,{p.cents}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  currency: { fontFamily: font.bold, color: color.ink2, marginRight: 6 },
  int: { fontFamily: font.black, color: color.paper, letterSpacing: -0.8 },
  cents: { fontFamily: font.bold, color: color.ink2, marginLeft: 1 },
});
