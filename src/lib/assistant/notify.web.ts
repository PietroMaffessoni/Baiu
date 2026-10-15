import type { Alert } from './insights';

// Na web não há notificações locais; as funções existem para manter a mesma interface.
export async function scheduleDigest(_alerts: Alert[], _now?: Date) {
  return false;
}
export async function cancelDigest() {}
