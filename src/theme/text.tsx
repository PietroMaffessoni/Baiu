import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { color, font } from './tokens';

export type Variant =
  | 'display'
  | 'hero'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'body'
  | 'bodyStrong'
  | 'callout'
  | 'calloutStrong'
  | 'caption'
  | 'captionStrong'
  | 'micro';

type Props = TextProps & {
  variant?: Variant;
  tone?: keyof typeof tones;
  /** Algarismos de largura fixa, para valores que precisam alinhar. */
  tabular?: boolean;
  align?: TextStyle['textAlign'];
};

const tones = {
  paper: color.paper,
  ink2: color.ink2,
  ink3: color.ink3,
  lantern: color.lantern,
  jade: color.jade,
  vermilion: color.vermilion,
  night: color.night,
} as const;

/** Tamanhos que travam o crescimento com o tamanho de fonte do sistema. */
const maxScale: Partial<Record<Variant, number>> = {
  display: 1.15,
  hero: 1.2,
  title1: 1.25,
  title2: 1.3,
};

export function T({ variant = 'body', tone = 'paper', tabular, align, style, ...rest }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={maxScale[variant] ?? 1.6}
      style={[
        styles[variant],
        { color: tones[tone] },
        tabular && styles.tabular,
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}

export const styles = StyleSheet.create({
  display: { fontFamily: font.black, fontSize: 44, lineHeight: 54, letterSpacing: -0.6 },
  hero: { fontFamily: font.black, fontSize: 34, lineHeight: 42, letterSpacing: -0.4 },
  title1: { fontFamily: font.bold, fontSize: 30, lineHeight: 38, letterSpacing: -0.3 },
  title2: { fontFamily: font.bold, fontSize: 20, lineHeight: 27 },
  title3: { fontFamily: font.bold, fontSize: 17, lineHeight: 23 },
  body: { fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  callout: { fontSize: 15, lineHeight: 20 },
  calloutStrong: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
  captionStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  micro: { fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  tabular: { fontVariant: ['tabular-nums'] },
});
