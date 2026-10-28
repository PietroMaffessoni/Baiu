import type { Mood } from '@/lib/folego';

/**
 * Caixa de desenho do Baiu. O centro do corpo fica sempre no mesmo lugar,
 * com folga acima da cabeça.
 */
export const VB_W = 200;
export const VB_H = 200;
export const CX = 100;
export const CY = 112;

/** Murcho cede para baixo; estufado vira uma bola. */
const SHAPE: Record<Mood, { rx: number; ryT: number; ryB: number }> = {
  estufado: { rx: 74, ryT: 72, ryB: 74 },
  cheio: { rx: 70, ryT: 66, ryB: 70 },
  meio: { rx: 65, ryT: 58, ryB: 66 },
  murcho: { rx: 60, ryT: 47, ryB: 62 },
};

export function geom(mood: Mood) {
  const { rx, ryT, ryB } = SHAPE[mood];
  const cy = CY;
  return {
    rx,
    ryT,
    ryB,
    cy,
    top: cy - ryT,
    bottom: cy + ryB,
    eyeY: cy - ryT * 0.08,
    eyeDX: rx * 0.36,
    /** Tamanho dos olhos acompanha o corpo. */
    eyeR: 8.8 * (rx / 70),
    mouthY: cy + ryB * 0.3,
    cheekY: cy + ryB * 0.17,
    cheekDX: rx * 0.6,
    finY: cy + ryB * 0.16,
    finX: rx - 6,
  };
}

/** Corpo como quatro curvas: topo e base podem ter raios diferentes. */
export function bodyPath(mood: Mood, scale = 1) {
  const g = geom(mood);
  const rx = g.rx * scale;
  const ryT = g.ryT * scale;
  const ryB = g.ryB * scale;
  const cy = g.cy;
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
