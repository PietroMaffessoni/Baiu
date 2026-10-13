import type { Category } from './types';
import type { IconName } from '@/components/icon';

export const CATEGORY: Record<Category, { label: string; icon: IconName }> = {
  renda: { label: 'Renda', icon: 'income' },
  mercado: { label: 'Mercado', icon: 'basket' },
  alimentacao: { label: 'Alimentação', icon: 'food' },
  transporte: { label: 'Transporte', icon: 'car' },
  casa: { label: 'Casa', icon: 'home' },
  saude: { label: 'Saúde', icon: 'health' },
  assinaturas: { label: 'Assinaturas', icon: 'repeat' },
  compras: { label: 'Compras', icon: 'bag' },
  lazer: { label: 'Lazer', icon: 'ticket' },
  cartao: { label: 'Fatura do cartão', icon: 'card' },
  reserva: { label: 'Reserva', icon: 'vault' },
  investimento: { label: 'Investimento', icon: 'growth' },
};

export const METHOD_LABEL = {
  pix: 'Pix',
  cartao: 'Cartão',
  boleto: 'Boleto',
  debito: 'Débito',
  ted: 'TED',
} as const;
