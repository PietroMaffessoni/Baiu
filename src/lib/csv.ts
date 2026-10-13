import { bankById, KIND_LABEL } from '@/data/banks';
import { CATEGORY, METHOD_LABEL } from '@/data/categories';
import type { Account, State } from '@/data/types';
import { accountTotal } from './ledger';
import { sortedTxs } from './summary';

/**
 * Exportação em CSV (separador ";" e vírgula decimal, como o Excel em português).
 * Células que começam com = + - @ ou tabulação recebem um apóstrofo para não
 * virarem fórmula ao abrir a planilha (injeção de CSV).
 */
export function cell(v: string | number): string {
  let s = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : v;
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const accName = (a?: Account) => (a ? `${a.nickname ?? bankById(a.bankId).name} (${KIND_LABEL[a.kind]})` : '');

const TIPO = { saida: 'Saída', entrada: 'Entrada', transferencia: 'Transferência' } as const;

export function transactionsCsv(state: State): string {
  const byId = new Map(state.accounts.map((a) => [a.id, a]));
  const rows = [['Data', 'Descrição', 'Tipo', 'Categoria', 'Forma', 'Conta', 'Destino', 'Valor'].map(cell).join(';')];
  for (const t of sortedTxs(state)) {
    const value = t.kind === 'saida' ? -t.amount : t.amount;
    rows.push(
      [
        t.date.slice(0, 10),
        t.description,
        TIPO[t.kind],
        CATEGORY[t.category].label,
        t.method ? METHOD_LABEL[t.method] : '',
        accName(byId.get(t.accountId)),
        t.toAccountId ? accName(byId.get(t.toAccountId)) : '',
        value,
      ]
        .map(cell)
        .join(';'),
    );
  }
  return '﻿' + rows.join('\r\n') + '\r\n';
}

export function accountsCsv(state: State): string {
  const rows = [['Instituição', 'Apelido', 'Tipo', 'Saldo'].map(cell).join(';')];
  for (const a of state.accounts) {
    const total = a.kind === 'cartao' ? -a.balance : accountTotal(a, state.holdings);
    rows.push([bankById(a.bankId).name, a.nickname ?? '', KIND_LABEL[a.kind], total].map(cell).join(';'));
  }
  return '﻿' + rows.join('\r\n') + '\r\n';
}
