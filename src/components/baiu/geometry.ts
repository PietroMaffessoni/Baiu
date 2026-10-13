import type { Mood } from '@/lib/folego';

/** Caixa de desenho do Baiu. O topo do corpo fica sempre na mesma altura, preso ao fio. */
export const VB_W = 200;
export const VB_H = 240;
export const TOP = 22;
export const CX = 100;

const SHAPE: Record<Mood, { rx: number; ryT: number; ryB: number }> = {
  estufado: { rx: 86, ryT: 84, ryB: 86 },
  cheio: { rx: 82, ryT: 79, ryB: 82 },
  meio: { rx: 76, ryT: 70, ryB: 80 },
  murcho: { rx: 68, ryT: 60, ryB: 78 },
};

export type Palette = {
  core: string;
  mid: string;
  edge: string;
  rim: string;
  spot: string;
  rib: string;
  belly: string;
  fin: string;
  glow: number;
};

/** A pele acende conforme o fôlego: do papel apagado ao âmbar aceso. */
export const PALETTE: Record<Mood, Palette> = {
  estufado: {
    core: '#FFF4D2',
    mid: '#FFD37B',
    edge: '#F6A43F',
    rim: '#C9671F',
    spot: '#B4581F',
    rib: '#B8601E',
    belly: '#FFF7E2',
    fin: '#FFC160',
    glow: 1,
  },
  cheio: {
    core: '#FFEEC4',
    mid: '#FFC765',
    edge: '#EE9536',
    rim: '#BC5E1C',
    spot: '#A9521D',
    rib: '#A9561B',
    belly: '#FFF2D6',
    fin: '#F7AE4C',
    glow: 0.72,
  },
  meio: {
    core: '#F3DCAB',
    mid: '#E2AC62',
    edge: '#C98238',
    rim: '#965221',
    spot: '#86471D',
    rib: '#8C4E1F',
    belly: '#F2E0BE',
    fin: '#D99A52',
    glow: 0.4,
  },
  murcho: {
    core: '#DCC9A6',
    mid: '#C19A6B',
    edge: '#9E7445',
    rim: '#6F4B27',
    spot: '#634020',
    rib: '#6A4725',
    belly: '#D8C6A4',
    fin: '#B08658',
    glow: 0.12,
  },
};

export function geom(mood: Mood) {
  const { rx, ryT, ryB } = SHAPE[mood];
  const cy = TOP + ryT;
  return {
    rx,
    ryT,
    ryB,
    cy,
    bottom: cy + ryB,
    eyeY: cy - 4,
    eyeDX: rx * 0.3,
    mouthY: cy + ryB * 0.27,
    cheekY: cy + ryB * 0.15,
    cheekDX: rx * 0.52,
    finY: cy + ryB * 0.2,
    finX: rx - 7,
  };
}

/** Corpo como quatro curvas: topo e base podem ter raios diferentes (o murcho cede para baixo). */
export function bodyPath(mood: Mood) {
  const { rx, ryT, ryB, cy } = geom(mood);
  const k = 0.5523;
  const x = CX;
  return [
    `M ${x} ${cy - ryT}`,
    `C ${x + k * rx} ${cy - ryT} ${x + rx} ${cy - k * ryT} ${x + rx} ${cy}`,
    `C ${x + rx} ${cy + k * ryB} ${x + k * rx} ${cy + ryB} ${x} ${cy + ryB}`,
    `C ${x - k * rx} ${cy + ryB} ${x - rx} ${cy + k * ryB} ${x - rx} ${cy}`,
    `C ${x - rx} ${cy - k * ryT} ${x - k * rx} ${cy - ryT} ${x} ${cy - ryT}`,
    'Z',
  ].join(' ');
}

/** Ponto na borda do corpo, ângulo em graus (0 = direita, 90 = baixo). */
export function rimPoint(mood: Mood, deg: number, scale = 1) {
  const { rx, ryT, ryB, cy } = geom(mood);
  const a = (deg * Math.PI) / 180;
  const s = Math.sin(a);
  return { x: CX + rx * scale * Math.cos(a), y: cy + (s < 0 ? ryT : ryB) * scale * s };
}
