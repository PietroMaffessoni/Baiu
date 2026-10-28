/**
 * Cores do Baiu. A base é o âmbar do corpo com o Baiu cheio; o humor mexe na
 * saturação e na luz. Tudo é calculado no aparelho.
 */

const BASE = '#F2A33A';

type Hsl = { h: number; s: number; l: number };

function toHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return { h, s, l };
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function hsl(h: number, s: number, l: number) {
  s = clamp(s);
  l = clamp(l);
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`.toUpperCase();
}

export type MoodKey = 'murcho' | 'meio' | 'cheio' | 'estufado';

export type BaiuPalette = {
  core: string;
  mid: string;
  edge: string;
  rim: string;
  spot: string;
  belly: string;
  fin: string;
  spine: string;
  glowColor: string;
  /** 0 a 1: quanto o Baiu brilha. */
  glow: number;
};

/** Do apagado (murcho) ao vivo (estufado): o humor mexe na saturação e na luz. */
const MOOD_SHIFT: Record<MoodKey, { s: number; l: number; glow: number }> = {
  estufado: { s: 1.08, l: 0.04, glow: 1 },
  cheio: { s: 1, l: 0, glow: 0.72 },
  meio: { s: 0.72, l: -0.05, glow: 0.4 },
  murcho: { s: 0.38, l: -0.12, glow: 0.12 },
};

export function paletteFor(mood: MoodKey): BaiuPalette {
  const { h, s: s0, l: l0 } = toHsl(BASE);
  const m = MOOD_SHIFT[mood];
  const s = s0 * m.s;
  const l = l0 + m.l;
  return {
    core: hsl(h, s * 0.85, l + 0.28),
    mid: hsl(h, s, l + 0.1),
    edge: hsl(h, s, l - 0.05),
    rim: hsl(h, s * 0.9, l - 0.24),
    spot: hsl(h, s * 0.8, l - 0.27),
    belly: hsl(h, s * 0.4, mood === 'murcho' ? 0.8 : 0.93),
    fin: hsl(h, s, l + 0.04),
    spine: hsl(h, s * 0.9, l - 0.16),
    glowColor: hsl(h, Math.min(1, s * 1.1), Math.min(0.72, l + 0.12)),
    glow: m.glow,
  };
}
