/**
 * Baiu: chão índigo, luz âmbar, papel.
 * Vermelhão e jade só aparecem como estado (selo, alerta, entrada).
 */
export const color = {
  night: '#0F1A3D',
  nightDeep: '#0A1230',
  plate: '#16234D',
  plateHi: '#1E2D5E',
  line: 'rgba(168, 184, 238, 0.14)',
  lineStrong: 'rgba(168, 184, 238, 0.30)',
  paper: '#F4F0E6',
  ink2: '#A9B3D6',
  ink3: '#8590BA',
  lantern: '#FFB648',
  lanternCore: '#FFE3A1',
  lanternDeep: '#E58A2B',
  lanternWash: 'rgba(255, 182, 72, 0.12)',
  vermilion: '#F2573C',
  vermilionWash: 'rgba(242, 87, 60, 0.14)',
  jade: '#5ED6A7',
  lacquer: '#151A2E',
  sumi: '#2A1A10',
} as const;

export const font = {
  black: 'ZenMaru-Black',
  bold: 'ZenMaru-Bold',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  x3: 32,
  x4: 40,
  x5: 56,
} as const;

/** Margem lateral de toda tela. */
export const gutter = 20;

export const radius = {
  tile: 10,
  plate: 18,
  pill: 999,
} as const;
