import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { color, font } from '@/theme/tokens';

type Props = {
  lines: [string, string?];
  date?: string;
  earned: boolean;
  size?: number;
  /** Cor do fundo onde o selo é carimbado, para as falhas de tinta. */
  ground?: string;
  seed?: number;
};

/** Selo carimbado em vermelhão, como num caderno de carimbos. */
export function Seal({ lines, date, earned, size = 88, ground = color.night, seed = 0 }: Props) {
  const tilt = ((seed * 37) % 13) - 6;
  const ink = earned ? color.vermilion : color.ink3;
  const c = size / 2;
  const r1 = c - 3;
  const r2 = c - 9;

  // falhas de tinta: pequenos arcos na cor do fundo sobre o anel externo
  const gaps = earned
    ? [0, 1, 2].map((i) => {
        const a0 = ((seed * 53 + i * 131) % 360) * (Math.PI / 180);
        const a1 = a0 + 0.22 + i * 0.05;
        const p0 = { x: c + r1 * Math.cos(a0), y: c + r1 * Math.sin(a0) };
        const p1 = { x: c + r1 * Math.cos(a1), y: c + r1 * Math.sin(a1) };
        return `M ${p0.x} ${p0.y} A ${r1} ${r1} 0 0 1 ${p1.x} ${p1.y}`;
      })
    : [];

  // a linha mais longa precisa caber dentro do anel interno
  const longest = Math.max(...lines.filter(Boolean).map((l) => (l as string).length));
  const fs = Math.min(size * 0.16, (size * 0.6) / (longest * 0.66));

  return (
    <View
      style={{
        width: size,
        height: size,
        transform: [{ rotate: `${earned ? tilt : 0}deg` }],
        opacity: earned ? 1 : 0.7,
      }}
      accessible
      accessibilityLabel={`${lines.filter(Boolean).join(' ')}${earned ? `, conquistado${date ? ` em ${date}` : ''}` : ', ainda não conquistado'}`}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={c}
          cy={c}
          r={r1}
          stroke={ink}
          strokeWidth={3.2}
          fill={earned ? color.vermilionWash : 'none'}
          strokeDasharray={earned ? undefined : '4 5'}
        />
        <Circle cx={c} cy={c} r={r2} stroke={ink} strokeWidth={1.2} fill="none" strokeOpacity={earned ? 1 : 0.6} />
        {gaps.map((d, i) => (
          <Path key={i} d={d} stroke={ground} strokeWidth={1.6} strokeOpacity={0.7} fill="none" />
        ))}
      </Svg>
      <View style={styles.center}>
        <Text allowFontScaling={false} style={[styles.line, { color: ink, fontSize: fs, lineHeight: fs * 1.18 }]}>
          {lines[0].toUpperCase()}
        </Text>
        {lines[1] ? (
          <Text allowFontScaling={false} style={[styles.line, { color: ink, fontSize: fs, lineHeight: fs * 1.18 }]}>
            {lines[1].toUpperCase()}
          </Text>
        ) : null}
        {date ? (
          <Text allowFontScaling={false} style={[styles.date, { color: ink, fontSize: Math.round(size * 0.1) }]}>
            {date.toUpperCase()}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  line: { fontFamily: font.black, textAlign: 'center', letterSpacing: 0.4 },
  date: { fontFamily: font.bold, marginTop: 3, letterSpacing: 1 },
});
