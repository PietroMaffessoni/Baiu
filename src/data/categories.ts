import type { IconName } from '@/components/icon';
import type { Category, HoldingKind, InCategory, Method, OutCategory } from './types';

export const CATEGORY: Record<Category, { label: string; icon: IconName }> = {
  mercado: { label: 'Mercado', icon: 'basket' },
  alimentacao: { label: 'Alimentação', icon: 'food' },
  transporte: { label: 'Transporte', icon: 'car' },
  casa: { label: 'Casa', icon: 'home' },
  contas: { label: 'Contas e serviços', icon: 'receipt' },
  saude: { label: 'Saúde', icon: 'health' },
  educacao: { label: 'Educação', icon: 'book' },
  assinaturas: { label: 'Assinaturas', icon: 'repeat' },
  compras: { label: 'Compras', icon: 'bag' },
  lazer: { label: 'Lazer', icon: 'ticket' },
  viagem: { label: 'Viagem', icon: 'plane' },
  pets: { label: 'Pets', icon: 'paw' },
  outros: { label: 'Outros', icon: 'more' },
  salario: { label: 'Salário', icon: 'briefcase' },
  renda_extra: { label: 'Renda extra', icon: 'sparkle' },
  rendimento: { label: 'Rendimento', icon: 'growth' },
  reembolso: { label: 'Reembolso', icon: 'undo' },
  presente: { label: 'Presente', icon: 'gift' },
  outras_entradas: { label: 'Outras entradas', icon: 'income' },
  transferencia: { label: 'Transferência', icon: 'swap' },
};

export const OUT_CATEGORIES: OutCategory[] = [
  'mercado',
  'alimentacao',
  'transporte',
  'casa',
  'contas',
  'saude',
  'educacao',
  'assinaturas',
  'compras',
  'lazer',
  'viagem',
  'pets',
  'outros',
];

export const IN_CATEGORIES: InCategory[] = [
  'salario',
  'renda_extra',
  'rendimento',
  'reembolso',
  'presente',
  'outras_entradas',
];

export const METHOD_LABEL: Record<Method, string> = {
  pix: 'Pix',
  cartao: 'Cartão',
  debito: 'Débito',
  boleto: 'Boleto',
  ted: 'TED',
  dinheiro: 'Dinheiro',
};

export const METHODS: Method[] = ['pix', 'debito', 'boleto', 'ted', 'dinheiro'];

export const HOLDING_KINDS: HoldingKind[] = [
  'Tesouro',
  'CDB',
  'LCI/LCA',
  'Fundo',
  'FII',
  'ETF',
  'Ações',
  'Cripto',
  'Previdência',
  'Outro',
];
