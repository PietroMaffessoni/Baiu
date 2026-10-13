import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { color } from '@/theme/tokens';

/** A luz da lanterna caindo no chão índigo. Intensidade acompanha o fôlego. */
export function GroundLight({
  width,
  height,
  cx,
  cy,
  intensity,
}: {
  width: number;
  height: number;
  cx: number;
  cy: number;
  intensity: number;
}) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient
            id="ground-light"
            cx={cx}
            cy={cy}
            rx={width * 0.8}
            ry={height * 0.5}
            gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color.lantern} stopOpacity={0.15 * intensity} />
            <Stop offset="0.38" stopColor={color.lantern} stopOpacity={0.045 * intensity} />
            <Stop offset="1" stopColor={color.lantern} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={cx} cy={cy} rx={width * 0.8} ry={height * 0.5} fill="url(#ground-light)" />
      </Svg>
    </View>
  );
}
