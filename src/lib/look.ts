/**
 * Aparência do Baiu: a cor que a pessoa escolhe e os enfeites das datas
 * comemorativas. Tudo é calculado no aparelho, sem rede.
 */

export type BaiuColor = 'ambar' | 'coral' | 'rosa' | 'lilas' | 'azul' | 'turquesa' | 'verde' | 'grafite';

export type BaiuLook = { color: BaiuColor; seasonal: boolean };

export const DEFAULT_LOOK: BaiuLook = { color: 'ambar', seasonal: true };

/** Cores oferecidas. A base é o tom do corpo com o Baiu cheio. */
export const COLORS: { id: BaiuColor; name: string; base: string }[] = [
  { id: 'ambar', name: 'Âmbar', base: '#F2A33A' },
  { id: 'coral', name: 'Coral', base: '#F0785A' },
  { id: 'rosa', name: 'Rosa', base: '#E97DAE' },
  { id: 'lilas', name: 'Lilás', base: '#A688E6' },
  { id: 'azul', name: 'Azul', base: '#5B9CF0' },
  { id: 'turquesa', name: 'Turquesa', base: '#38C2B8' },
  { id: 'verde', name: 'Verde', base: '#72C266' },
  { id: 'grafite', name: 'Grafite', base: '#8C95B8' },
];

export function isBaiuColor(v: unknown): v is BaiuColor {
  return typeof v === 'string' && COLORS.some((c) => c.id === v);
}

export function colorOf(id: BaiuColor) {
  return COLORS.find((c) => c.id === id) ?? COLORS[0];
}

// ---------- datas comemorativas ----------

export type Season = 'ano-novo' | 'carnaval' | 'pascoa' | 'namorados' | 'junina' | 'criancas' | 'halloween' | 'natal';

export const SEASONS: { id: Season; name: string; para: string; look: string }[] = [
  { id: 'ano-novo', name: 'Ano Novo', para: 'o Ano Novo', look: 'Chapéu de festa e confete' },
  { id: 'carnaval', name: 'Carnaval', para: 'o Carnaval', look: 'Penas coloridas e confete' },
  { id: 'pascoa', name: 'Páscoa', para: 'a Páscoa', look: 'Orelhas de coelho' },
  { id: 'namorados', name: 'Dia dos Namorados', para: 'o Dia dos Namorados', look: 'Corações' },
  { id: 'junina', name: 'Festa Junina', para: 'a Festa Junina', look: 'Chapéu de palha e sardas' },
  { id: 'criancas', name: 'Dia das Crianças', para: 'o Dia das Crianças', look: 'Boné de hélice' },
  { id: 'halloween', name: 'Halloween', para: 'o Halloween', look: 'Chapéu de bruxa' },
  { id: 'natal', name: 'Natal', para: 'o Natal', look: 'Gorro de Papai Noel' },
];

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const plus = (date: Date, n: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

/** Período de cada data num ano, do primeiro ao último dia (inclusive). */
export function seasonRanges(year: number): { id: Season; start: Date; end: Date }[] {
  const e = easter(year);
  return [
    { id: 'ano-novo', start: day(year - 1, 12, 26), end: day(year, 1, 2) },
    // sábado de Carnaval até a Quarta-feira de Cinzas
    { id: 'carnaval', start: plus(e, -50), end: plus(e, -46) },
    // da Semana Santa ao domingo de Páscoa
    { id: 'pascoa', start: plus(e, -7), end: e },
    { id: 'namorados', start: day(year, 6, 6), end: day(year, 6, 12) },
    { id: 'junina', start: day(year, 6, 13), end: day(year, 6, 30) },
    { id: 'criancas', start: day(year, 10, 6), end: day(year, 10, 12) },
    { id: 'halloween', start: day(year, 10, 25), end: day(year, 10, 31) },
    { id: 'natal', start: day(year, 12, 1), end: day(year, 12, 25) },
    { id: 'ano-novo', start: day(year, 12, 26), end: day(year + 1, 1, 2) },
  ];
}

/** A data comemorativa de hoje, se houver. */
export function seasonFor(now = new Date()): Season | null {
  const today = day(now.getFullYear(), now.getMonth() + 1, now.getDate());
  for (const r of seasonRanges(now.getFullYear())) {
    if (today >= r.start && today <= r.end) return r.id;
  }
  return null;
}

/** As próximas datas, a partir de hoje, uma de cada. */
export function upcomingSeasons(now = new Date()) {
  const today = day(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const all = [...seasonRanges(now.getFullYear()), ...seasonRanges(now.getFullYear() + 1)]
    .filter((r) => r.end >= today)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const seen = new Set<Season>();
  return all.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

// ---------- paleta ----------

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

export function paletteFor(color: BaiuColor, mood: MoodKey): BaiuPalette {
  const { h, s: s0, l: l0 } = toHsl(colorOf(color).base);
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
