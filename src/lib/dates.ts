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

/** Mesma data no mês seguinte; dia 31 vira o último dia do mês quando ele for menor. */
export function addMonth(iso: string) {
  const d = new Date(iso);
  const day = d.getDate();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1, d.getHours(), d.getMinutes());
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, last));
  return next.toISOString();
}

/** "há 5 min", "há 2 h", "ontem"... */
export function agoLabel(iso?: string, now = Date.now()) {
  if (!iso) return 'nunca';
  const min = Math.round((now - Date.parse(iso)) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}
