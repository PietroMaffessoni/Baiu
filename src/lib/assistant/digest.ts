import type { Alert } from './insights';

/** Horário do aviso: pelo menos duas horas depois, entre 10h e 20h. */
export function nextSlot(now = new Date()) {
  const t = new Date(now.getTime() + 2 * 3_600_000);
  if (t.getHours() < 10) t.setHours(10, 0, 0, 0);
  else if (t.getHours() >= 20) {
    t.setDate(t.getDate() + 1);
    t.setHours(10, 0, 0, 0);
  }
  return t;
}

/** Texto da notificação, sem valores: ela aparece na tela bloqueada. */
export function digestBody(alerts: Alert[]) {
  const first = alerts[0].push;
  if (alerts.length === 1) return `${first} Toque para conversar com o Baiu.`;
  const more = alerts.length - 1;
  return `${first} E mais ${more} ${more === 1 ? 'coisa' : 'coisas'} para ver.`;
}
