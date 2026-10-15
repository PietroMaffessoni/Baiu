import type { Bill } from '@/data/types';

// Na web não há notificações locais; as funções existem para manter a mesma interface.
export async function configureReminders() {}
export async function remindersAllowed(_ask: boolean) {
  return false;
}
export async function syncReminders(_bills: Bill[], _enabled: boolean) {}
export async function syncTrialReminder(_at: Date | null, _days: number) {}
export async function clearReminders() {}
export function useReminderRouting(_enabled: boolean) {}
