import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import type { Mood } from '@/lib/folego';
import { color } from '@/theme/tokens';
import { bodyPath, CX, geom, PALETTE, rimPoint, TOP, VB_H, VB_W } from './geometry';

const SUMI = color.sumi;

type ArtProps = { mood: Mood; width: number; puffed?: boolean };

/** Corpo da lanterna: pele acesa, costelas, pintas, tampas laqueadas, borla e boca. */
export function BaiuBody({ mood, width, puffed }: ArtProps) {
  const g = geom(mood);
  const p = PALETTE[mood];
  const d = bodyPath(mood);
  const id = `baiu-${mood}`;
  const showSpines = puffed || mood === 'estufado';

  const ribs = [-0.62, -0.3, 0.03, 0.35, 0.67].map((t) => {
    const ry = t < 0 ? g.ryT : g.ryB;
    const y = g.cy + t * ry;
    const w = g.rx * Math.sqrt(1 - t * t);
    const bulge = 10 * (1 - t * t);
    return `M ${CX - w} ${y} Q ${CX} ${y + bulge} ${CX + w} ${y}`;
  });

  const spots: [number, number, number][] = [
    [-0.56, -0.52, 5.2],
    [-0.22, -0.76, 4],
    [0.25, -0.73, 4.4],
    [0.57, -0.5, 4.6],
    [0.0, -0.92, 3.1],
    [-0.8, -0.14, 3.3],
    [0.8, -0.18, 3],
    [-0.4, -0.3, 2.4],
    [0.42, -0.32, 2.2],
  ];

  const gloss0 = rimPoint(mood, 198, 0.82);
  const gloss1 = rimPoint(mood, 244, 0.82);
  const glossDot = rimPoint(mood, 256, 0.8);

  const spineAngles = Array.from({ length: 22 }, (_, i) => i * (360 / 22) + 4).filter(
    (a) => Math.abs(a - 270) > 22 && Math.abs(a - 90) > 26,
  );

  const b = g.bottom;

  return (
    <Svg width={width} height={(width * VB_H) / VB_W} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Defs>
        <RadialGradient id={`${id}-skin`} cx="42%" cy="36%" rx="70%" ry="70%" fx="38%" fy="30%">
          <Stop offset="0" stopColor={p.core} />
          <Stop offset="0.4" stopColor={p.mid} />
          <Stop offset="0.8" stopColor={p.edge} />
          <Stop offset="1" stopColor={p.rim} />
        </RadialGradient>
        <RadialGradient id={`${id}-belly`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={p.belly} stopOpacity={0.9} />
          <Stop offset="1" stopColor={p.belly} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={`${id}-lacquer`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2B3150" />
          <Stop offset="1" stopColor={color.lacquer} />
        </LinearGradient>
        <ClipPath id={`${id}-clip`}>
          <Path d={d} />
        </ClipPath>
      </Defs>

      {/* fio curto até a argola */}
      <Line x1={CX} y1={0} x2={CX} y2={TOP - 13} stroke={color.paper} strokeOpacity={0.5} strokeWidth={1.4} />
      <Circle cx={CX} cy={TOP - 10} r={3.4} stroke={color.lacquer} strokeWidth={2.2} fill="none" />

      {/* borla vermelha */}
      <Line x1={CX} y1={b + 4} x2={CX} y2={b + 11} stroke={color.lacquer} strokeWidth={2} />
      <Circle cx={CX} cy={b + 12.5} r={3.6} fill={color.vermilion} />
      <Path
        d={`M ${CX - 3.6} ${b + 15} L ${CX + 3.6} ${b + 15} L ${CX + 5.6} ${b + 35} Q ${CX} ${b + 38} ${CX - 5.6} ${b + 35} Z`}
        fill={color.vermilion}
      />
      {[-2.2, 0, 2.2].map((dx) => (
        <Line key={dx} x1={CX + dx} y1={b + 19} x2={CX + dx * 1.5} y2={b + 35} stroke="#B53B25" strokeWidth={0.9} />
      ))}
      <Rect x={CX - 11} y={b - 3} width={22} height={8} rx={3} fill={`url(#${id}-lacquer)`} />

      {/* pele */}
      <Path d={d} fill={`url(#${id}-skin)`} />
      <G clipPath={`url(#${id}-clip)`}>
        <Ellipse cx={CX} cy={g.cy + g.ryB * 0.55} rx={g.rx * 0.72} ry={g.ryB * 0.48} fill={`url(#${id}-belly)`} />
        {ribs.map((r, i) => (
          <Path key={i} d={r} stroke={p.rib} strokeOpacity={0.28} strokeWidth={1.3} fill="none" />
        ))}
        {spots.map(([ux, uy, r], i) => (
          <Circle
            key={i}
            cx={CX + ux * g.rx}
            cy={g.cy + uy * (uy < 0 ? g.ryT : g.ryB)}
            r={r}
            fill={p.spot}
            fillOpacity={0.4}
          />
        ))}
      </G>
      <Path d={d} fill="none" stroke={p.rim} strokeOpacity={0.55} strokeWidth={1.6} />

      {/* brilho do laqueado */}
      <Path
        d={`M ${gloss0.x} ${gloss0.y} A ${g.rx * 0.82} ${g.ryT * 0.82} 0 0 1 ${gloss1.x} ${gloss1.y}`}
        stroke="#FFFFFF"
        strokeOpacity={0.5}
        strokeWidth={4.5}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={glossDot.x} cy={glossDot.y} r={2.3} fill="#FFFFFF" fillOpacity={0.55} />

      {/* tampa de cima */}
      <Rect x={CX - 15} y={TOP - 7} width={30} height={11} rx={4} fill={`url(#${id}-lacquer)`} />
      <Line
        x1={CX - 10}
        y1={TOP - 4.6}
        x2={CX + 10}
        y2={TOP - 4.6}
        stroke="#FFFFFF"
        strokeOpacity={0.2}
        strokeWidth={1.2}
        strokeLinecap="round"
      />

      {/* espinhos: aparecem quando ele estufa */}
      {showSpines &&
        spineAngles.map((a) => {
          const p0 = rimPoint(mood, a, 1.03);
          const p1 = rimPoint(mood, a, 1.11);
          return (
            <Line
              key={a}
              x1={p0.x}
              y1={p0.y}
              x2={p1.x}
              y2={p1.y}
              stroke={color.lanternCore}
              strokeOpacity={0.85}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
          );
        })}

      <Face mood={mood} puffed={puffed} />
    </Svg>
  );
}

function Face({ mood, puffed }: { mood: Mood; puffed?: boolean }) {
  const g = geom(mood);
  const my = g.mouthY;
  const blush = puffed || mood === 'cheio' || mood === 'estufado';

  return (
    <G>
      {blush && (
        <>
          <Ellipse
            cx={CX - g.cheekDX}
            cy={g.cheekY}
            rx={puffed ? 11 : 9}
            ry={puffed ? 6.5 : 5.4}
            fill={color.vermilion}
            fillOpacity={0.3}
          />
          <Ellipse
            cx={CX + g.cheekDX}
            cy={g.cheekY}
            rx={puffed ? 11 : 9}
            ry={puffed ? 6.5 : 5.4}
            fill={color.vermilion}
            fillOpacity={0.3}
          />
        </>
      )}
      {puffed ? (
        <>
          <Ellipse cx={CX} cy={my + 1} rx={5.6} ry={6.6} fill={SUMI} />
          <Ellipse cx={CX} cy={my + 3.2} rx={3} ry={2.4} fill={color.vermilion} fillOpacity={0.85} />
        </>
      ) : mood === 'estufado' ? (
        <>
          <Path
            d={`M ${CX - 13} ${my - 2} Q ${CX} ${my + 15} ${CX + 13} ${my - 2} Q ${CX} ${my + 2} ${CX - 13} ${my - 2} Z`}
            fill={SUMI}
          />
          <Ellipse cx={CX} cy={my + 4.6} rx={4.6} ry={2} fill={color.vermilion} />
        </>
      ) : mood === 'cheio' ? (
        <Path
          d={`M ${CX - 11} ${my - 2} Q ${CX} ${my + 8} ${CX + 11} ${my - 2}`}
          stroke={SUMI}
          strokeWidth={3.6}
          strokeLinecap="round"
          fill="none"
        />
      ) : mood === 'meio' ? (
        <Path
          d={`M ${CX - 7} ${my} Q ${CX} ${my + 2.5} ${CX + 7} ${my}`}
          stroke={SUMI}
          strokeWidth={3.2}
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <Path
          d={`M ${CX - 9} ${my + 4} Q ${CX} ${my - 4} ${CX + 9} ${my + 4}`}
          stroke={SUMI}
          strokeWidth={3.2}
          strokeLinecap="round"
          fill="none"
        />
      )}
    </G>
  );
}

/** Olhos em camada própria, para piscar sem redesenhar o corpo. */
export function BaiuEyes({ mood, width, puffed }: ArtProps) {
  const g = geom(mood);
  const L = CX - g.eyeDX;
  const R = CX + g.eyeDX;
  const y = g.eyeY;

  let content;
  if (puffed) {
    content = [L, R].map((x) => (
      <G key={x}>
        <Ellipse cx={x} cy={y} rx={7.8} ry={9.6} fill={SUMI} />
        <Circle cx={x - 2.4} cy={y - 3.4} r={2.8} fill="#FFFFFF" />
        <Circle cx={x + 2.4} cy={y + 3} r={1.2} fill="#FFFFFF" fillOpacity={0.75} />
      </G>
    ));
  } else if (mood === 'estufado') {
    content = [L, R].map((x) => (
      <Path
        key={x}
        d={`M ${x - 9} ${y + 3} Q ${x} ${y - 9} ${x + 9} ${y + 3}`}
        stroke={SUMI}
        strokeWidth={4.2}
        strokeLinecap="round"
        fill="none"
      />
    ));
  } else if (mood === 'murcho') {
    content = [L, R].map((x, i) => {
      const dir = i === 0 ? 1 : -1;
      return (
        <G key={x}>
          <Path d={`M ${x - 7.4} ${y} A 7.4 7 0 0 0 ${x + 7.4} ${y} Z`} fill={SUMI} />
          <Line x1={x - 9} x2={x + 9} y1={y - 0.4} y2={y - 0.4} stroke={SUMI} strokeWidth={2.6} strokeLinecap="round" />
          <Line
            x1={x - 8 * dir}
            y1={y - 9}
            x2={x + 6 * dir}
            y2={y - 14}
            stroke={SUMI}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
        </G>
      );
    });
  } else {
    const ry = mood === 'cheio' ? 8.8 : 7.8;
    content = [L, R].map((x) => (
      <G key={x}>
        <Ellipse cx={x} cy={y} rx={7.2} ry={ry} fill={SUMI} />
        <Circle cx={x - 2.3} cy={y - 3.1} r={2.5} fill="#FFFFFF" />
        <Circle cx={x + 2.2} cy={y + 2.8} r={1.1} fill="#FFFFFF" fillOpacity={0.7} />
      </G>
    ));
  }

  return (
    <Svg width={width} height={(width * VB_H) / VB_W} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      {content}
    </Svg>
  );
}

/** Nadadeira peitoral. side -1 = esquerda. */
export function BaiuFin({ mood, width, side }: { mood: Mood; width: number; side: -1 | 1 }) {
  const g = geom(mood);
  const p = PALETTE[mood];
  const rootX = CX + side * g.finX;
  const rootY = g.finY;
  const s = side;
  const fin = `M ${rootX} ${rootY - 9} C ${rootX + s * 10} ${rootY - 17} ${rootX + s * 27} ${rootY - 15} ${rootX + s * 32} ${rootY - 4} C ${rootX + s * 28} ${rootY + 5} ${rootX + s * 16} ${rootY + 12} ${rootX} ${rootY + 9} Z`;
  return (
    <Svg width={width} height={(width * VB_H) / VB_W} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Path d={fin} fill={p.fin} fillOpacity={0.95} stroke={p.rim} strokeOpacity={0.45} strokeWidth={1.1} />
      {[
        [-4, -5, -25, -9],
        [-4, 0, -28, -2],
        [-4, 5, -23, 6],
      ].map(([x0, y0, x1, y1], i) => (
        <Line
          key={i}
          x1={rootX - s * x0}
          y1={rootY + y0}
          x2={rootX - s * x1}
          y2={rootY + y1}
          stroke={p.rim}
          strokeOpacity={0.45}
          strokeWidth={1}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

/** Halo de luz atrás da lanterna. Nunca uma borda brilhante, só luz que cai. */
export function Halo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="baiu-halo" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#FFC56B" stopOpacity={0.6} />
          <Stop offset="0.36" stopColor="#FFB04A" stopOpacity={0.42} />
          <Stop offset="0.5" stopColor="#FF9F3A" stopOpacity={0.14} />
          <Stop offset="0.68" stopColor="#FF9F3A" stopOpacity={0.03} />
          <Stop offset="1" stopColor="#FF9F3A" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={50} cy={50} r={50} fill="url(#baiu-halo)" />
    </Svg>
  );
}
