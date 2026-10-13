export type LockInfo = { available: boolean; method: string; hint?: string };

// Bloqueio biométrico não existe na web.
export async function lockInfo(): Promise<LockInfo> {
  return { available: false, method: 'Bloqueio', hint: 'Disponível no iPhone e no Android.' };
}

export async function authenticate(_reason: string) {
  return true;
}
