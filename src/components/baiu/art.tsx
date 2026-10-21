import type { ReactNode } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { Mood } from '@/lib/folego';
import type { BaiuPalette, Season } from '@/lib/look';
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

/** Corpo do baiacu: rabo, dorsal, pele, barriga, pintas, espinhos, rosto e enfeite da data. */
export function BaiuBody({ mood, width, pal, id, puffed, season }: ArtProps & { season?: Season | null }) {
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

      {/* nadadeira dorsal: some quando há chapéu */}
      {(!season || season === 'namorados') && (
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
      )}

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
      {season ? <Accessory season={season} mood={mood} pal={pal} id={id} /> : null}
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

// ---------- enfeites das datas comemorativas ----------

const CONFETTI: [number, number, number, string][] = [
  [26, 52, 20, '#F25C9C'],
  [170, 46, -30, '#F5C542'],
  [16, 104, 45, '#4AA8F0'],
  [184, 98, 10, '#72C266'],
  [30, 160, -15, '#F5C542'],
  [176, 150, 35, '#F25C9C'],
  [60, 22, 60, '#4AA8F0'],
  [146, 18, -50, '#A688E6'],
];

function Confetti() {
  return (
    <>
      {CONFETTI.map(([x, y, a, c], i) => (
        <Rect
          key={i}
          x={x - 3}
          y={y - 1.6}
          width={6}
          height={3.2}
          rx={1}
          fill={c}
          transform={`rotate(${a} ${x} ${y})`}
        />
      ))}
    </>
  );
}

function heart(x: number, y: number, s: number) {
  return `M ${x} ${y + 6 * s} C ${x - 12 * s} ${y - 3 * s} ${x - 6 * s} ${y - 13 * s} ${x} ${y - 6 * s} C ${x + 6 * s} ${y - 13 * s} ${x + 12 * s} ${y - 3 * s} ${x} ${y + 6 * s} Z`;
}

function Headband({ mood, stroke, width = 5 }: { mood: Mood; stroke: string; width?: number }) {
  const a = rimPoint(mood, 208, 0.99);
  const b = rimPoint(mood, 332, 0.99);
  const g = geom(mood);
  return (
    <Path
      d={`M ${a.x} ${a.y} A ${g.rx * 0.99} ${g.ryT * 0.99} 0 0 1 ${b.x} ${b.y}`}
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      fill="none"
    />
  );
}

function Accessory({ season, mood, pal, id }: { season: Season; mood: Mood; pal: BaiuPalette; id: string }) {
  const g = geom(mood);
  const t = g.top;
  const w = g.rx;

  switch (season) {
    case 'natal': {
      const tip = { x: CX + w * 0.86, y: t + 6 };
      return (
        <G>
          <Path
            d={`M ${CX - w * 0.6} ${t + 10} C ${CX - w * 0.52} ${t - 20} ${CX + w * 0.05} ${t - 36} ${CX + w * 0.46} ${t - 22} C ${CX + w * 0.68} ${t - 14} ${CX + w * 0.82} ${t - 6} ${tip.x} ${tip.y} L ${CX + w * 0.74} ${t + 2} C ${CX + w * 0.62} ${t - 6} ${CX + w * 0.54} ${t - 2} ${CX + w * 0.56} ${t + 9} Z`}
            fill="#D9353B"
            stroke="#A3262B"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          <Path
            d={`M ${CX - w * 0.2} ${t - 18} C ${CX} ${t - 28} ${CX + w * 0.3} ${t - 26} ${CX + w * 0.46} ${t - 20}`}
            stroke="#FFFFFF"
            strokeOpacity={0.25}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
          <Rect
            x={CX - w * 0.68}
            y={t + 2}
            width={w * 1.34}
            height={14}
            rx={7}
            fill="#F8F4EC"
            stroke="#DDD3C4"
            strokeWidth={1}
          />
          <Circle cx={tip.x} cy={tip.y + 2} r={7} fill="#F8F4EC" stroke="#DDD3C4" strokeWidth={1} />
        </G>
      );
    }
    case 'halloween':
      return (
        <G>
          <Ellipse cx={CX} cy={t + 9} rx={w * 0.86} ry={8.5} fill="#33264F" stroke="#21183A" strokeWidth={1.2} />
          <Path
            d={`M ${CX - w * 0.42} ${t + 7} C ${CX - w * 0.26} ${t - 8} ${CX - w * 0.1} ${t - 24} ${CX + w * 0.04} ${t - 29} Q ${CX + w * 0.22} ${t - 35} ${CX + w * 0.4} ${t - 29} Q ${CX + w * 0.2} ${t - 24} ${CX + w * 0.16} ${t - 15} C ${CX + w * 0.22} ${t - 5} ${CX + w * 0.34} ${t + 2} ${CX + w * 0.42} ${t + 7} Z`}
            fill="#3D2D5E"
            stroke="#21183A"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          <Path
            d={`M ${CX - w * 0.38} ${t + 2} Q ${CX} ${t + 6} ${CX + w * 0.38} ${t + 2} L ${CX + w * 0.32} ${t - 5} Q ${CX} ${t - 1} ${CX - w * 0.33} ${t - 5} Z`}
            fill="#F28C28"
          />
          <Rect x={CX - 4} y={t - 4} width={8} height={7} rx={1.5} fill="none" stroke="#F5C542" strokeWidth={1.8} />
        </G>
      );
    case 'pascoa':
      return (
        <G>
          {[-1, 1].map((s) => (
            <G key={s} transform={`rotate(${s * 14} ${CX + s * w * 0.3} ${t + 4})`}>
              <Ellipse
                cx={CX + s * w * 0.3}
                cy={t - 16}
                rx={9}
                ry={23}
                fill="#FBF7F2"
                stroke="#E3D8CC"
                strokeWidth={1.2}
              />
              <Ellipse cx={CX + s * w * 0.3} cy={t - 14} rx={4.4} ry={16} fill="#F6A9C2" />
            </G>
          ))}
          <Headband mood={mood} stroke="#F6A9C2" />
        </G>
      );
    case 'ano-novo':
      return (
        <G>
          <Confetti />
          <ClipPath id={`${id}-party`}>
            <Path d={`M ${CX - w * 0.34} ${t + 8} L ${CX - w * 0.08} ${t - 30} L ${CX + w * 0.24} ${t + 4} Z`} />
          </ClipPath>
          <Path
            d={`M ${CX - w * 0.34} ${t + 8} L ${CX - w * 0.08} ${t - 30} L ${CX + w * 0.24} ${t + 4} Z`}
            fill="#F5C542"
          />
          <G clipPath={`url(#${id}-party)`}>
            {[-14, 0, 14].map((y) => (
              <Line
                key={y}
                x1={CX - w * 0.5}
                y1={t + y + 2}
                x2={CX + w * 0.4}
                y2={t + y - 10}
                stroke="#E84A8A"
                strokeWidth={4.5}
              />
            ))}
          </G>
          <Path
            d={`M ${CX - w * 0.34} ${t + 8} L ${CX - w * 0.08} ${t - 30} L ${CX + w * 0.24} ${t + 4} Z`}
            fill="none"
            stroke="#C99A1E"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          <Circle cx={CX - w * 0.08} cy={t - 31} r={5.5} fill="#4AA8F0" />
        </G>
      );
    case 'carnaval': {
      const feathers = ['#A688E6', '#3FC7C0', '#F5C542', '#F25C9C', '#F28C28'];
      return (
        <G>
          <Confetti />
          {[-44, -22, 0, 22, 44].map((a, i) => (
            <G key={a} transform={`rotate(${a} ${CX} ${t + 8})`}>
              <Path
                d={`M ${CX} ${t + 6} C ${CX - 7} ${t - 6} ${CX - 7} ${t - 20} ${CX} ${t - 30} C ${CX + 7} ${t - 20} ${CX + 7} ${t - 6} ${CX} ${t + 6} Z`}
                fill={feathers[i]}
              />
              <Line x1={CX} y1={t + 4} x2={CX} y2={t - 24} stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={1} />
            </G>
          ))}
          <Headband mood={mood} stroke="#F5C542" width={6} />
          {[-0.36, 0, 0.36].map((x) => {
            const p = rimPoint(mood, 270 + x * 90, 0.99);
            return <Circle key={x} cx={p.x} cy={p.y} r={3.2} fill={x === 0 ? '#F25C9C' : '#3FC7C0'} />;
          })}
        </G>
      );
    }
    case 'namorados':
      return (
        <G>
          <Path d={heart(CX + w * 0.92, t + 4, 1)} fill="#F2576E" />
          <Path d={heart(CX + w * 1.08, t - 20, 0.65)} fill="#F78AA0" />
          <Path d={heart(CX - w * 0.98, t + 12, 0.75)} fill="#F78AA0" />
          {[-1, 1].map((s) => (
            <Path key={s} d={heart(CX + s * g.cheekDX, g.cheekY + 1, 0.42)} fill="#F2576E" fillOpacity={0.65} />
          ))}
        </G>
      );
    case 'junina':
      return (
        <G>
          <Ellipse cx={CX} cy={t + 8} rx={w * 0.98} ry={10} fill="#E9C46A" stroke="#B98F3C" strokeWidth={1.2} />
          {[-0.7, -0.35, 0.35, 0.7].map((x) => (
            <Line
              key={x}
              x1={CX + x * w}
              y1={t + 4}
              x2={CX + x * w * 1.12}
              y2={t + 13}
              stroke="#B98F3C"
              strokeOpacity={0.6}
              strokeWidth={1}
            />
          ))}
          <Path
            d={`M ${CX - w * 0.46} ${t + 7} C ${CX - w * 0.46} ${t - 18} ${CX + w * 0.46} ${t - 18} ${CX + w * 0.46} ${t + 7} Z`}
            fill="#E2B95A"
            stroke="#B98F3C"
            strokeWidth={1.2}
          />
          <Path
            d={`M ${CX - w * 0.46} ${t + 1} C ${CX - w * 0.2} ${t + 4} ${CX + w * 0.2} ${t + 4} ${CX + w * 0.46} ${t + 1} L ${CX + w * 0.46} ${t + 7} C ${CX + w * 0.2} ${t + 10} ${CX - w * 0.2} ${t + 10} ${CX - w * 0.46} ${t + 7} Z`}
            fill="#D9353B"
          />
          <Rect x={CX + w * 0.1} y={t - 11} width={10} height={9} rx={1} fill="#C7774A" />
          <Path
            d={`M ${CX + w * 0.1 + 2} ${t - 9} l 6 5 M ${CX + w * 0.1 + 8} ${t - 9} l -6 5`}
            stroke="#8E4E2C"
            strokeWidth={0.9}
          />
          {[-1, 1].map((s) =>
            [
              [-3, -2],
              [3, -2.5],
              [0, 2.5],
            ].map(([dx, dy], i) => (
              <Circle
                key={`${s}${i}`}
                cx={CX + s * g.cheekDX + dx}
                cy={g.cheekY + dy}
                r={1.3}
                fill={pal.spot}
                fillOpacity={0.75}
              />
            )),
          )}
        </G>
      );
    case 'criancas': {
      return (
        <G>
          <ClipPath id={`${id}-cap`}>
            <Path
              d={`M ${CX - w * 0.52} ${t + 10} C ${CX - w * 0.52} ${t - 16} ${CX + w * 0.52} ${t - 16} ${CX + w * 0.52} ${t + 10} Z`}
            />
          </ClipPath>
          <G clipPath={`url(#${id}-cap)`}>
            <Rect x={CX - w * 0.6} y={t - 20} width={w * 0.4} height={34} fill="#E84A4A" />
            <Rect x={CX - w * 0.2} y={t - 20} width={w * 0.4} height={34} fill="#F5C542" />
            <Rect x={CX + w * 0.2} y={t - 20} width={w * 0.4} height={34} fill="#4A90E2" />
          </G>
          <Path
            d={`M ${CX - w * 0.52} ${t + 10} C ${CX - w * 0.52} ${t - 16} ${CX + w * 0.52} ${t - 16} ${CX + w * 0.52} ${t + 10} Z`}
            fill="none"
            stroke="#2A1A10"
            strokeOpacity={0.25}
            strokeWidth={1.2}
          />
          <Ellipse cx={CX} cy={t + 10} rx={w * 0.34} ry={5} fill="#3D7BD0" />
          <Line x1={CX} y1={t - 9} x2={CX} y2={t - 17} stroke="#2A1A10" strokeWidth={2} />
          <Ellipse cx={CX - 9} cy={t - 18} rx={9} ry={3} fill="#E84A4A" />
          <Ellipse cx={CX + 9} cy={t - 18} rx={9} ry={3} fill="#4A90E2" />
          <Circle cx={CX} cy={t - 18} r={2.6} fill="#F5C542" />
        </G>
      );
    }
  }
}
