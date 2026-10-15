import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { Bill } from '@/data/types';

/**
 * Lembretes de vencimento por notificação local. Nada sai do aparelho.
 * O texto nunca mostra valores: a notificação aparece na tela bloqueada.
 */
const CHANNEL = 'vencimentos';
/** Canal e identificador dos avisos de gastos do Baiu (src/lib/assistant/notify.ts). */
export const ALERTS_CHANNEL = 'avisos';
export const ALERTS_ID = 'baiu-avisos';
const MAX_BILLS = 30; // iOS guarda até 64 agendamentos; dois por vencimento

let configured = false;

export async function configureReminders() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Vencimentos',
      description: 'Avisos de contas a pagar',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync(ALERTS_CHANNEL, {
      name: 'Avisos do Baiu',
      description: 'Quando um gasto foge do normal',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Retorna se pode notificar. Só pergunta ao usuário quando `ask` é verdadeiro. */
export async function remindersAllowed(ask: boolean): Promise<boolean> {
  await configureReminders();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;
  if (!ask || !current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return res.granted;
}

export async function syncReminders(bills: Bill[], enabled: boolean) {
  await configureReminders();
  // refaz só os lembretes de vencimento; o aviso de gastos tem vida própria
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier !== ALERTS_ID) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  if (!enabled || !(await remindersAllowed(false))) return;

  const now = Date.now();
  const upcoming = bills
    .filter((b) => !b.paid)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, MAX_BILLS);

  for (const b of upcoming) {
    const due = new Date(b.dueDate);
    const slots = [
      { id: `${b.id}-1`, at: new Date(due.getFullYear(), due.getMonth(), due.getDate() - 1, 9), title: 'Vence amanhã' },
      { id: `${b.id}-0`, at: new Date(due.getFullYear(), due.getMonth(), due.getDate(), 9), title: 'Vence hoje' },
    ];
    for (const slot of slots) {
      if (slot.at.getTime() <= now) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: slot.id,
        content: {
          title: slot.title,
          body: `${b.title}. Abra o Baiu para marcar como pago.`,
          data: { url: '/vencimentos' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: slot.at, channelId: CHANNEL },
      });
    }
  }
}

export async function clearReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Tocar no lembrete abre a lista de vencimentos. */
export function useReminderRouting(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const go = (n: Notifications.Notification) => {
      const url = n.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as '/vencimentos' | '/baiu');
    };
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (alive && r?.notification) go(r.notification);
    });
    const sub = Notifications.addNotificationResponseReceivedListener((r) => go(r.notification));
    return () => {
      alive = false;
      sub.remove();
    };
  }, [enabled]);
}
