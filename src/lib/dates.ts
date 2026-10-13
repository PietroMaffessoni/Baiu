export const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const DAY = 86_400_000;

export function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY);
}

/** "Hoje", "Ontem" ou "sábado, 10 de outubro". */
export function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  const diff = daysBetween(d, now);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** "10 out" */
export function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`;
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return 'Boa noite';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function longToday(now = new Date()) {
  return `${DIAS[now.getDay()]}, ${now.getDate()} de ${MESES[now.getMonth()]}`;
}
