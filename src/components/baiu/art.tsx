import type { ReactNode } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, Path, RadialGradient, Stop } from 'react-native-svg';

import type { Mood } from '@/lib/folego';
import type { BaiuPalette } from '@/lib/palette';
import { color } from '@/theme/tokens';
import { bodyPath, CX, geom, rimPoint, VB_H, VB_W } from './geometry';

const SUMI = color.sumi;

type ArtProps = { mood: Mood; width: number; pal: BaiuPalette; id: string; puffed?: boolean };

const box = (width: number, children: ReactNode) => (
  <Svg width={width} height={(width * VB_H) / VB_W} viewBox={`0 0 ${VB_W} ${VB_H}`}>
    {children}
  </Svg>
);

/** Ângulos (graus) onde nascem os espinhos: tudo menos nadadeiras, rabo e dorsal. */
const SPINE_ANGLES = Array.from({ length: 26 }, (_, i) => i * (360 / 26) + 3).filter(
  (a) =>
    Math.abs(a - 0) > 14 &&
    Math.abs(a - 360) > 14 &&
    Math.abs(a - 180) > 14 &&
    (a < 24 || a > 54) &&
    (a < 246 || a > 296),
);

/** Corpo do baiacu: rabo, dorsal, pele, barriga, pintas, espinhos e rosto. */
export function BaiuBody({ mood, width, pal, id, puffed }: ArtProps) {
  const g = geom(mood);
  const d = bodyPath(mood);
  const showSpines = puffed || mood === 'estufado';

  // rabo atrás do corpo, saindo embaixo à direita
  const tailRoot = rimPoint(mood, 38, 0.86);
  // dorsal atrás do corpo, no alto
  const dorsal = { x: CX + 4, y: g.top + 9 };

  const spots: [number, number, number][] = [
    [-0.5, -0.58, 4.6],
    [-0.16, -0.8, 3.6],
    [0.22, -0.74, 4.2],
    [0.54, -0.52, 4],
    [-0.76, -0.22, 3],
    [0.78, -0.26, 2.8],
    [-0.32, -0.36, 2.2],
    [0.36, -0.4, 2.4],
    [0.02, -0.52, 2.6],
  ];

  const gloss0 = rimPoint(mood, 196, 0.8);
  const gloss1 = rimPoint(mood, 240, 0.8);
  const glossDot = rimPoint(mood, 252, 0.78);

  return box(
    width,
    <>
      <Defs>
        <RadialGradient id={`${id}-skin`} cx="42%" cy="34%" rx="72%" ry="72%" fx="36%" fy="28%">
          <Stop offset="0" stopColor={pal.core} />
          <Stop offset="0.42" stopColor={pal.mid} />
          <Stop offset="0.82" stopColor={pal.edge} />
          <Stop offset="1" stopColor={pal.rim} />
        </RadialGradient>
        <RadialGradient id={`${id}-belly`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={pal.belly} stopOpacity={0.95} />
          <Stop offset="0.7" stopColor={pal.belly} stopOpacity={0.7} />
          <Stop offset="1" stopColor={pal.belly} stopOpacity={0} />
        </RadialGradient>
        <ClipPath id={`${id}-clip`}>
          <Path d={d} />
        </ClipPath>
      </Defs>

      {/* rabo */}
      <G transform={`translate(${tailRoot.x} ${tailRoot.y}) rotate(38)`}>
        <Path
          d="M 0 -8 C 10 -10 18 -19 27 -21 C 24 -11 22 -5 21 0 C 22 5 24 11 27 21 C 18 19 10 10 0 8 Z"
          fill={pal.fin}
          stroke={pal.rim}
          strokeOpacity={0.5}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        {[-13, 0, 13].map((y) => (
          <Line key={y} x1={4} y1={0} x2={21} y2={y} stroke={pal.rim} strokeOpacity={0.35} strokeWidth={1} />
        ))}
      </G>

      {/* nadadeira dorsal */}
      <G transform={`translate(${dorsal.x} ${dorsal.y})`}>
        <Path
          d="M -16 6 C -14 -8 -4 -19 9 -21 C 13 -13 16 -4 16 7 Z"
          fill={pal.fin}
          stroke={pal.rim}
          strokeOpacity={0.5}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        {[
          [-8, -10],
          [0, -15],
          [8, -16],
        ].map(([x, y]) => (
          <Line key={x} x1={x * 0.3} y1={4} x2={x} y2={y} stroke={pal.rim} strokeOpacity={0.35} strokeWidth={1} />
        ))}
      </G>

      {/* espinhos: aparecem quando ele estufa */}
      {showSpines &&
        SPINE_ANGLES.map((a) => {
          const b0 = rimPoint(mood, a - 4, 0.98);
          const b1 = rimPoint(mood, a + 4, 0.98);
          const tip = rimPoint(mood, a, 1.13);
          return (
            <Path
              key={a}
              d={`M ${b0.x} ${b0.y} L ${tip.x} ${tip.y} L ${b1.x} ${b1.y} Z`}
              fill={pal.spine}
              stroke={pal.rim}
              strokeOpacity={0.4}
              strokeWidth={0.8}
              strokeLinejoin="round"
            />
          );
        })}

      {/* pele */}
      <Path d={d} fill={`url(#${id}-skin)`} />
      <G clipPath={`url(#${id}-clip)`}>
        <Ellipse cx={CX} cy={g.cy + g.ryB * 0.62} rx={g.rx * 0.86} ry={g.ryB * 0.58} fill={`url(#${id}-belly)`} />
        {spots.map(([ux, uy, r], i) => (
          <Circle
            key={i}
            cx={CX + ux * g.rx}
            cy={g.cy + uy * g.ryT}
            r={r * (g.rx / 70)}
            fill={pal.spot}
            fillOpacity={0.42}
          />
        ))}
        {/* pele sobrando quando murcha */}
        {mood === 'murcho' &&
          [0.5, 0.68].map((t) => (
            <Path
              key={t}
              d={`M ${CX - g.rx * 0.5} ${g.cy + g.ryB * t} Q ${CX} ${g.cy + g.ryB * (t + 0.12)} ${CX + g.rx * 0.5} ${g.cy + g.ryB * t}`}
              stroke={pal.rim}
              strokeOpacity={0.35}
              strokeWidth={1.4}
              strokeLinecap="round"
              fill="none"
            />
          ))}
      </G>
      <Path d={d} fill="none" stroke={pal.rim} strokeOpacity={0.55} strokeWidth={1.6} />

      {/* brilho da pele */}
      <Path
        d={`M ${gloss0.x} ${gloss0.y} A ${g.rx * 0.8} ${g.ryT * 0.8} 0 0 1 ${gloss1.x} ${gloss1.y}`}
        stroke="#FFFFFF"
        strokeOpacity={0.45}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={glossDot.x} cy={glossDot.y} r={2.2} fill="#FFFFFF" fillOpacity={0.5} />

      <Face mood={mood} puffed={puffed} />
    </>,
  );
}

function Face({ mood, puffed }: { mood: Mood; puffed?: boolean }) {
  const g = geom(mood);
  const my = g.mouthY;
  const k = g.rx / 70;
  const blush = puffed || mood === 'cheio' || mood === 'estufado';

  return (
    <G>
      {blush &&
        [-1, 1].map((s) => (
          <Ellipse
            key={s}
            cx={CX + s * g.cheekDX}
            cy={g.cheekY}
            rx={(puffed ? 10.5 : 8.5) * k}
            ry={(puffed ? 6.2 : 5) * k}
            fill={color.vermilion}
            fillOpacity={0.3}
          />
        ))}
      {puffed ? (
        <>
          <Ellipse cx={CX} cy={my + 1} rx={5.4 * k} ry={6.4 * k} fill={SUMI} />
          <Ellipse cx={CX} cy={my + 3 * k} rx={2.9 * k} ry={2.3 * k} fill={color.vermilion} fillOpacity={0.85} />
        </>
      ) : mood === 'estufado' ? (
        <>
          <Path
            d={`M ${CX - 12 * k} ${my - 2} Q ${CX} ${my + 14 * k} ${CX + 12 * k} ${my - 2} Q ${CX} ${my + 2} ${CX - 12 * k} ${my - 2} Z`}
            fill={SUMI}
          />
          <Ellipse cx={CX} cy={my + 4.3 * k} rx={4.3 * k} ry={1.9 * k} fill={color.vermilion} />
        </>
      ) : mood === 'cheio' ? (
        <Path
          d={`M ${CX - 10 * k} ${my - 2} Q ${CX} ${my + 7.5 * k} ${CX + 10 * k} ${my - 2}`}
          stroke={SUMI}
          strokeWidth={3.4}
          strokeLinecap="round"
          fill="none"
        />
      ) : mood === 'meio' ? (
        <Path
          d={`M ${CX - 7 * k} ${my} Q ${CX} ${my + 2.5 * k} ${CX + 7 * k} ${my}`}
          stroke={SUMI}
          strokeWidth={3.1}
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <Path
          d={`M ${CX - 8.5 * k} ${my + 4} Q ${CX} ${my - 4} ${CX + 8.5 * k} ${my + 4}`}
          stroke={SUMI}
          strokeWidth={3.1}
          strokeLinecap="round"
          fill="none"
        />
      )}
    </G>
  );
}

/** Olhos em camada própria, para piscar sem redesenhar o corpo. */
export function BaiuEyes({ mood, width, puffed }: { mood: Mood; width: number; puffed?: boolean }) {
  const g = geom(mood);
  const L = CX - g.eyeDX;
  const R = CX + g.eyeDX;
  const y = g.eyeY;
  const r = g.eyeR;

  let content;
  if (puffed) {
    content = [L, R].map((x) => (
      <G key={x}>
        <Ellipse cx={x} cy={y} rx={r * 1.02} ry={r * 1.2} fill={SUMI} />
        <Circle cx={x - r * 0.3} cy={y - r * 0.42} r={r * 0.36} fill="#FFFFFF" />
        <Circle cx={x + r * 0.3} cy={y + r * 0.36} r={r * 0.15} fill="#FFFFFF" fillOpacity={0.75} />
      </G>
    ));
  } else if (mood === 'estufado') {
    content = [L, R].map((x) => (
      <Path
        key={x}
        d={`M ${x - r * 1.05} ${y + r * 0.35} Q ${x} ${y - r * 1.05} ${x + r * 1.05} ${y + r * 0.35}`}
        stroke={SUMI}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
    ));
  } else if (mood === 'murcho') {
    content = [L, R].map((x, i) => {
      const dir = i === 0 ? 1 : -1;
      return (
        <G key={x}>
          <Path d={`M ${x - r * 0.85} ${y} A ${r * 0.85} ${r * 0.8} 0 0 0 ${x + r * 0.85} ${y} Z`} fill={SUMI} />
          <Line x1={x - r} x2={x + r} y1={y - 0.4} y2={y - 0.4} stroke={SUMI} strokeWidth={2.5} strokeLinecap="round" />
          <Line
            x1={x - r * 0.9 * dir}
            y1={y - r}
            x2={x + r * 0.7 * dir}
            y2={y - r * 1.55}
            stroke={SUMI}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </G>
      );
    });
  } else {
    const ry = mood === 'cheio' ? r * 1.08 : r * 0.96;
    content = [L, R].map((x) => (
      <G key={x}>
        <Ellipse cx={x} cy={y} rx={r * 0.9} ry={ry} fill={SUMI} />
        <Circle cx={x - r * 0.28} cy={y - r * 0.38} r={r * 0.32} fill="#FFFFFF" />
        <Circle cx={x + r * 0.27} cy={y + r * 0.34} r={r * 0.14} fill="#FFFFFF" fillOpacity={0.7} />
      </G>
    ));
  }

  return box(width, content);
}

/** Nadadeira peitoral. side -1 = esquerda. */
export function BaiuFin({ mood, width, side, pal }: { mood: Mood; width: number; side: -1 | 1; pal: BaiuPalette }) {
  const g = geom(mood);
  const rootX = CX + side * g.finX;
  const rootY = g.finY;
  const s = side;
  const fin = `M ${rootX} ${rootY - 8} C ${rootX + s * 9} ${rootY - 16} ${rootX + s * 24} ${rootY - 14} ${rootX + s * 28} ${rootY - 4} C ${rootX + s * 25} ${rootY + 5} ${rootX + s * 14} ${rootY + 11} ${rootX} ${rootY + 8} Z`;
  return box(
    width,
    <>
      <Path d={fin} fill={pal.fin} fillOpacity={0.96} stroke={pal.rim} strokeOpacity={0.5} strokeWidth={1.1} />
      {[
        [-4, -4, -22, -8],
        [-4, 0, -25, -2],
        [-4, 4, -20, 5],
      ].map(([x0, y0, x1, y1], i) => (
        <Line
          key={i}
          x1={rootX - s * x0}
          y1={rootY + y0}
          x2={rootX - s * x1}
          y2={rootY + y1}
          stroke={pal.rim}
          strokeOpacity={0.4}
          strokeWidth={1}
          strokeLinecap="round"
        />
      ))}
    </>,
  );
}

/** Luz suave atrás do Baiu, na cor dele. Mais forte com mais fôlego. */
export function Halo({ size, tint, id }: { size: number; tint: string; id: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={`${id}-halo`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={tint} stopOpacity={0.5} />
          <Stop offset="0.36" stopColor={tint} stopOpacity={0.3} />
          <Stop offset="0.52" stopColor={tint} stopOpacity={0.1} />
          <Stop offset="0.7" stopColor={tint} stopOpacity={0.02} />
          <Stop offset="1" stopColor={tint} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={50} cy={50} r={50} fill={`url(#${id}-halo)`} />
    </Svg>
  );
}
