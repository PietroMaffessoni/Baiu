export type Bank = {
  id: string;
  name: string;
  /** Monograma: nunca usamos a marca do banco, só iniciais e uma cor próxima. */
  mono: string;
  bg: string;
  fg: string;
};

export const BANKS: Bank[] = [
  { id: 'nubank', name: 'Nubank', mono: 'Nu', bg: '#7A1FC9', fg: '#FFFFFF' },
  { id: 'itau', name: 'Itaú', mono: 'It', bg: '#EC7000', fg: '#0B2A6B' },
  { id: 'inter', name: 'Inter', mono: 'In', bg: '#FF7A00', fg: '#FFFFFF' },
  { id: 'caixa', name: 'Caixa', mono: 'Cx', bg: '#1C5FB0', fg: '#FFFFFF' },
  { id: 'bb', name: 'Banco do Brasil', mono: 'BB', bg: '#F7D117', fg: '#1B3C8C' },
  { id: 'bradesco', name: 'Bradesco', mono: 'Br', bg: '#CC092F', fg: '#FFFFFF' },
  { id: 'santander', name: 'Santander', mono: 'Sa', bg: '#E2231A', fg: '#FFFFFF' },
  { id: 'c6', name: 'C6 Bank', mono: 'C6', bg: '#242424', fg: '#FFFFFF' },
  { id: 'picpay', name: 'PicPay', mono: 'Pp', bg: '#21C25E', fg: '#FFFFFF' },
  { id: 'mercadopago', name: 'Mercado Pago', mono: 'MP', bg: '#00A6E0', fg: '#FFFFFF' },
  { id: 'xp', name: 'XP Investimentos', mono: 'XP', bg: '#121212', fg: '#F5C400' },
  { id: 'btg', name: 'BTG Pactual', mono: 'BT', bg: '#0B2447', fg: '#FFFFFF' },
  { id: 'rico', name: 'Rico', mono: 'Ri', bg: '#FF5A00', fg: '#FFFFFF' },
  { id: 'sicredi', name: 'Sicredi', mono: 'Si', bg: '#3FA535', fg: '#FFFFFF' },
  { id: 'neon', name: 'Neon', mono: 'Ne', bg: '#00C2E8', fg: '#0A1E3F' },
  { id: 'outro', name: 'Outra instituição', mono: '+', bg: '#2A3768', fg: '#F4F0E6' },
];

export function bankById(id: string): Bank {
  return BANKS.find((b) => b.id === id) ?? BANKS[BANKS.length - 1];
}

export const KIND_LABEL = {
  corrente: 'Conta corrente',
  reserva: 'Reserva',
  cartao: 'Cartão de crédito',
  investimento: 'Investimentos',
} as const;

export const KIND_HINT = {
  corrente: 'Onde o salário cai e os Pix saem.',
  reserva: 'Poupança ou caixinha para emergências.',
  cartao: 'Acompanhe a fatura e o vencimento.',
  investimento: 'Corretora, Tesouro, CDB, fundos.',
} as const;
