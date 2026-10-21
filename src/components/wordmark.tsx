import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { color } from '@/theme/tokens';

/**
 * Logotipo "baiu": traço único, cheio e arredondado, como o próprio baiacu.
 * O pingo do i é a luz âmbar da marca.
 */
export function Wordmark({ width = 120, tint = color.paper }: { width?: number; tint?: string }) {
  const h = (width * 164) / 382;
  const stroke = {
    stroke: tint,
    strokeWidth: 22,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={width} height={h} viewBox="0 0 382 164" accessibilityLabel="baiu">
      <Defs>
        <RadialGradient id="wm-dot" cx="40%" cy="36%" rx="62%" ry="62%">
          <Stop offset="0" stopColor={color.lanternCore} />
          <Stop offset="0.55" stopColor={color.lantern} />
          <Stop offset="1" stopColor={color.lanternDeep} />
        </RadialGradient>
      </Defs>
      {/* b */}
      <Path d="M11 14 V150" {...stroke} />
      <Circle cx={53} cy={108} r={42} {...stroke} />
      {/* a */}
      <Circle cx={173} cy={108} r={42} {...stroke} />
      <Path d="M215 66 V150" {...stroke} />
      {/* i */}
      <Path d="M251 66 V150" {...stroke} />
      <Circle cx={251} cy={20} r={16} fill="url(#wm-dot)" />
      {/* u */}
      <Path d="M287 66 V108 A42 42 0 0 0 371 108 V66" {...stroke} />
      <Path d="M371 66 V150" {...stroke} />
    </Svg>
  );
}
