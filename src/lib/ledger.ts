import type { Account, Holding, Tx } from '@/data/types';

/** Arredonda para centavos, evitando deriva de ponto flutuante. */
export const round2 = (n: number) => Math.round(n * 100) / 100;

export const MAX_AMOUNT = 99_999_999.99;

/**
 * Efeito de um fluxo no saldo guardado da conta.
 * No cartão o saldo é dívida: dinheiro entrando reduz, saindo aumenta.
 */
function flow(acc: Account, dir: 'in' | 'out', amount: number) {
  const card = acc.kind === 'cartao';
  if (dir === 'in') return card ? -amount : amount;
  return card ? amount : -amount;
}

/** Aplica (sign = 1) ou desfaz (sign = -1) um movimento nos saldos. */
export function applyTx(accounts: Account[], tx: Tx, sign: 1 | -1 = 1): Account[] {
  // movimento que veio do banco já está no saldo que o banco informa
  if (tx.ext) return accounts;
  return accounts.map((a) => {
    let d = 0;
    if (tx.kind === 'saida' && a.id === tx.accountId) d += flow(a, 'out', tx.amount);
    if (tx.kind === 'entrada' && a.id === tx.accountId) d += flow(a, 'in', tx.amount);
    if (tx.kind === 'transferencia') {
      if (a.id === tx.accountId) d += flow(a, 'out', tx.amount);
      if (a.id === tx.toAccountId) d += flow(a, 'in', tx.amount);
    }
    return d === 0 ? a : { ...a, balance: round2(a.balance + sign * d) };
  });
}

export function holdingsOf(accountId: string, holdings: Holding[]) {
  return holdings.filter((h) => h.accountId === accountId);
}

/** Valor total da conta. Investimento = saldo parado + ativos. */
export function accountTotal(a: Account, holdings: Holding[]) {
  if (a.kind !== 'investimento') return a.balance;
  return round2(a.balance + holdingsOf(a.id, holdings).reduce((n, h) => n + h.value, 0));
}

/**
 * Valor com sinal, do ponto de vista de uma conta (ou de todas).
 * Transferência entre contas próprias é neutra na visão geral.
 */
export function signedAmount(tx: Tx, perspective?: string) {
  if (tx.kind === 'saida') return -tx.amount;
  if (tx.kind === 'entrada') return tx.amount;
  if (perspective === tx.accountId) return -tx.amount;
  if (perspective === tx.toAccountId) return tx.amount;
  return 0;
}

type ById = Map<string, Account>;

/**
 * Entrada ou saída que só troca dinheiro de lugar entre contas da própria
 * pessoa (pagamento de fatura, Pix para si mesma) quando a outra ponta não
 * está no Baiu. Não conta como ganho nem como gasto.
 */
export const isNeutral = (tx: Tx) => tx.kind !== 'transferencia' && tx.category === 'transferencia';

/** Dinheiro que foi para investimentos vindo de fora deles. */
export function isAporte(tx: Tx, byId: ById) {
  if (tx.kind !== 'transferencia' || !tx.toAccountId) return false;
  const to = byId.get(tx.toAccountId);
  const from = byId.get(tx.accountId);
  return to?.kind === 'investimento' && from?.kind !== 'investimento';
}

/** Dinheiro que foi para a reserva vindo de fora dela. */
export function isGuardado(tx: Tx, byId: ById) {
  if (tx.kind !== 'transferencia' || !tx.toAccountId) return false;
  const to = byId.get(tx.toAccountId);
  const from = byId.get(tx.accountId);
  return to?.kind === 'reserva' && from?.kind !== 'reserva';
}

/** Valida um movimento antes de gravar. Retorna a mensagem de erro, ou null. */
export function validateTx(tx: Tx, byId: ById): string | null {
  if (!(tx.amount > 0)) return 'Informe um valor maior que zero.';
  if (tx.amount > MAX_AMOUNT) return 'Valor acima do limite aceito.';
  if (!byId.has(tx.accountId)) return 'Escolha uma conta.';
  if (Number.isNaN(new Date(tx.date).getTime())) return 'Data inválida.';
  if (tx.description.length > 80) return 'Descrição muito longa.';
  if (tx.kind === 'transferencia') {
    if (!tx.toAccountId || !byId.has(tx.toAccountId)) return 'Escolha a conta de destino.';
    if (tx.toAccountId === tx.accountId) return 'Origem e destino precisam ser contas diferentes.';
    if (byId.get(tx.accountId)?.kind === 'cartao') return 'Transferências não podem sair de um cartão.';
  }
  return null;
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
