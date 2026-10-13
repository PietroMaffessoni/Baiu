import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { color } from '@/theme/tokens';

export type MarkState = 'cheia' | 'parcial' | 'vazia' | 'riscada';

/**
 * Marca de estado em célula fixa. Cheia vale, vazada não, parcial está a
 * caminho, riscada é alerta. Sempre no mesmo lugar da linha.
 */
export function Mark({ state, size = 22, fill }: { state: MarkState; size?: number; fill?: number }) {
  const r = size / 2 - 1.5;
  const c = size / 2;
  return (
    <View style={[styles.cell, { width: size, height: size }]} accessibilityElementsHidden>
      <Svg width={size} height={size}>
        {state === 'cheia' && (
          <>
            <Circle cx={c} cy={c} r={r} fill={color.lantern} />
            <Path
              d={`M ${c - r * 0.42} ${c + 0.2} L ${c - r * 0.08} ${c + r * 0.34} L ${c + r * 0.46} ${c - r * 0.32}`}
              stroke={color.night}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </>
        )}
        {state === 'parcial' && (
          <>
            <Circle cx={c} cy={c} r={r} stroke={color.lantern} strokeWidth={1.5} fill="none" />
            <Path d={arcPath(c, r - 3.2, fill ?? 0.5)} fill={color.lantern} />
          </>
        )}
        {state === 'vazia' && <Circle cx={c} cy={c} r={r} stroke={color.lineStrong} strokeWidth={1.5} fill="none" />}
        {state === 'riscada' && (
          <>
            <Circle cx={c} cy={c} r={r} stroke={color.vermilion} strokeWidth={1.5} fill="none" />
            <Line
              x1={c - r * 0.55}
              y1={c + r * 0.55}
              x2={c + r * 0.55}
              y2={c - r * 0.55}
              stroke={color.vermilion}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </>
        )}
      </Svg>
    </View>
  );
}

/** Fatia de pizza a partir do topo, sentido horário. */
function arcPath(c: number, r: number, frac: number) {
  const f = Math.min(0.999, Math.max(0.001, frac));
  const a = f * Math.PI * 2 - Math.PI / 2;
  const x = c + r * Math.cos(a);
  const y = c + r * Math.sin(a);
  const large = f > 0.5 ? 1 : 0;
  return `M ${c} ${c} L ${c} ${c - r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`;
}

const styles = StyleSheet.create({
  cell: { alignItems: 'center', justifyContent: 'center' },
});
