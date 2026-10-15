import * as Notifications from 'expo-notifications';

import { ALERTS_CHANNEL, ALERTS_ID, configureReminders, remindersAllowed } from '../reminders';
import { digestBody, nextSlot } from './digest';
import type { Alert } from './insights';

/**
 * Aviso por notificação quando o Baiu nota um gasto fora do normal.
 * Agendado no próprio aparelho, um de cada vez, sem valores no texto:
 * a notificação aparece na tela bloqueada.
 */

/** Agenda o aviso com o que ainda não foi visto. Devolve se agendou. */
export async function scheduleDigest(alerts: Alert[], now = new Date()): Promise<boolean> {
  if (alerts.length === 0) return false;
  await configureReminders();
  if (!(await remindersAllowed(false))) return false;
  await Notifications.cancelScheduledNotificationAsync(ALERTS_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: ALERTS_ID,
    content: { title: 'O Baiu notou uma coisa', body: digestBody(alerts), data: { url: '/baiu' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextSlot(now), channelId: ALERTS_CHANNEL },
  });
  return true;
}

export async function cancelDigest() {
  await Notifications.cancelScheduledNotificationAsync(ALERTS_ID).catch(() => {});
}
