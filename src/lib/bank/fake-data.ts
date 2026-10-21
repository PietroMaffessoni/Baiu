import type { RemoteTx, SyncPayload } from './types';

/** Instituições do banco de teste. Nada aqui é real. */
export const FAKE_BANKS = [
  { id: 'exemplo', name: 'Banco Exemplo' },
  { id: 'digital', name: 'Banco Digital de Teste' },
];

const iso = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h, (d * 7) % 60).toISOString();

/**
 * Três meses de histórico e o mês atual até hoje, sempre iguais para a mesma
 * data: buscar de novo não duplica nada e, com o passar dos dias, aparecem
 * movimentos novos, como num banco de verdade.
 */
export function fakeBankData(itemId: string, name: string, now: Date): SyncPayload {
  const cc = `${itemId}:cc`;
  const card = `${itemId}:card`;
  const txs: RemoteTx[] = [];
  const push = (
    date: string,
    accountId: string,
    description: string,
    amount: number,
    type: RemoteTx['type'],
    p: Partial<RemoteTx> = {},
  ) => {
    if (new Date(date) > now) return;
    txs.push({ id: `${itemId}:${date.slice(0, 10)}:${txs.length}`, accountId, date, description, amount, type, ...p });
  };

  for (let back = 3; back >= 0; back--) {
    const y = now.getFullYear();
    const m = now.getMonth() - back;
    const k = back + 1;
    push(iso(y, m, 5, 9), cc, 'PAGTO SALARIO ACME TECNOLOGIA LTDA', 5800, 'CREDIT', {
      category: 'Salary',
      operationType: 'TED',
      party: 'cnpj',
    });
    push(iso(y, m, 6), cc, 'ALUGUEL IMOBILIARIA CENTRO', -1650, 'DEBIT', {
      category: 'Rent',
      operationType: 'PIX',
      party: 'cnpj',
    });
    push(iso(y, m, 8), cc, 'ENEL DISTRIBUICAO SP', -(128 + k * 7.35), 'DEBIT', {
      category: 'Electricity',
      operationType: 'BOLETO',
    });
    push(iso(y, m, 3, 21), card, 'NETFLIX.COM', 44.9, 'DEBIT', { category: 'Video streaming' });
    push(iso(y, m, 7), cc, 'APLICACAO CDB LIQUIDEZ', -500, 'DEBIT');
    push(iso(y, m, 10, 8), cc, 'PAGAMENTO DE FATURA', -1200, 'DEBIT', {
      category: 'Credit card payment',
      operationType: 'BOLETO',
    });
    push(iso(y, m, 10, 9), card, 'PAGAMENTO RECEBIDO', -1200, 'CREDIT', {
      category: 'Credit card payment',
      operationType: 'PAGAMENTO_FATURA',
    });
    push(iso(y, m, 14, 18), cc, 'PIX ENVIADO MARIA OLIVEIRA', -150, 'DEBIT', {
      category: 'Transfer - PIX',
      operationType: 'PIX',
      party: 'cpf',
    });
    push(iso(y, m, 15), card, 'DROGASIL 1234', 64.3, 'DEBIT', { category: 'Pharmacy' });
    push(iso(y, m, 19), card, 'COMERCIAL XYZ LTDA', 89.9, 'DEBIT');
    push(iso(y, m, 22, 8), card, 'PADARIA REAL', 23.5, 'DEBIT');
    push(iso(y, m, 25), cc, 'TARIFA PACOTE SERVICOS', -29.9, 'DEBIT', { operationType: 'PACOTE_TARIFA_SERVICOS' });
    push(iso(y, m, 26), cc, 'RENDIMENTO APLICACAO', 12.4 + k, 'CREDIT', {
      operationType: 'RENDIMENTO_APLIC_FINANCEIRA',
    });
    if (back % 2 === 0) {
      push(iso(y, m, 18, 15), cc, 'PIX RECEBIDO ESTUDIO LUMEN LTDA', back === 0 ? 1400 : 850, 'CREDIT', {
        operationType: 'PIX',
        party: 'cnpj',
      });
    }
    for (const d of [2, 9, 16, 23]) {
      push(iso(y, m, d, 20), card, 'IFOOD *RESTAURANTE', 38 + ((d * k) % 25), 'DEBIT', { category: 'Food delivery' });
      push(iso(y, m, d + 1, 17), cc, 'SUPERMERCADO DIA', -(160 + ((d * 3 + k) % 40)), 'DEBIT', {
        operationType: 'CARTAO',
      });
    }
    for (const d of [4, 12, 20, 27]) {
      push(iso(y, m, d, 8), card, 'UBER *TRIP', 18 + ((d + k) % 17), 'DEBIT');
    }
  }

  const due = new Date(now.getFullYear(), now.getMonth() + (now.getDate() > 10 ? 1 : 0), 10);
  const months = now.getMonth() + now.getFullYear() * 12;
  return {
    items: [{ id: itemId, name, status: 'UPDATED', updatedAt: now.toISOString() }],
    accounts: [
      {
        id: cc,
        itemId,
        type: 'BANK',
        subtype: 'CHECKING_ACCOUNT',
        name: 'Conta corrente',
        last4: '4321',
        balance: 3250.4 + now.getDate() * 3,
      },
      {
        id: card,
        itemId,
        type: 'CREDIT',
        subtype: 'CREDIT_CARD',
        name: 'Cartão Exemplo Gold',
        last4: '9876',
        balance: 1480.35,
        creditLimit: 8000,
        dueDate: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-10`,
      },
    ],
    transactions: txs,
    investments: [
      {
        id: `${itemId}:cdb`,
        itemId,
        name: 'CDB Liquidez Diária 100% CDI',
        type: 'FIXED_INCOME',
        subtype: 'CDB',
        balance: 5420.1 + (months % 12) * 41,
        invested: 5000,
      },
      {
        id: `${itemId}:selic`,
        itemId,
        name: 'Tesouro Selic 2029',
        type: 'FIXED_INCOME',
        subtype: 'TREASURY',
        balance: 3110.55,
        invested: 3000,
      },
    ],
  };
}
