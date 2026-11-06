import type { IconName } from '@/components/icon';

/**
 * Dados do "Começar", o caminho de quem baixou o Baiu até criar a conta.
 * Cada número tem fonte, mês e pesquisa: as lojas e as pessoas cobram que não
 * seja inventado. Ao trocar um número, troque a fonte junto e confira na
 * publicação original. As fontes ficam aqui, não na tela; as contas com as
 * respostas da pessoa são simulações escritas no condicional ("se for assim com
 * você"), e o Baiu não promete economia.
 */

/** Referências para as contas da vida inteira. */
export const REF = {
  expectativaVida: { value: 76.6, source: 'IBGE, Tábua Completa de Mortalidade de 2024' },
  /** Com a Selic acima de 8,5% ao ano, a poupança rende 0,5% ao mês mais a TR (Lei 12.703/2012). */
  poupancaMes: {
    value: 0.005,
    source: '0,5% ao mês, o rendimento da poupança enquanto a Selic passa de 8,5% ao ano (Lei 12.703/2012), sem a TR',
  },
};

/**
 * Juros pagos pelas famílias no 1º semestre de 2026 (1/1 a 30/6, 181 dias),
 * para o contador que corre na tela e para a média que escapa por mês.
 */
export const JUROS_FAMILIAS = {
  value: 515.4e9,
  months: 6,
  days: 181,
  /** Parte da renda das famílias que foi para juros no semestre. */
  renda: '14,64%',
  source: 'FecomercioSP, com dados do Banco Central e do IBGE, 1º semestre de 2026',
};

/** Para dividir os juros por pessoa e por casa. */
export const CENSO = {
  pessoas: 203_062_512,
  casas: 72_400_000,
  source: 'IBGE, Censo 2022: 203,1 milhões de pessoas e 72,4 milhões de domicílios particulares ocupados',
};

/**
 * Coisas em que o dinheiro que escapa na vida inteira se transforma. Preços
 * mudam: confira e atualize a fonte junto (a ação, principalmente).
 */
export const COISAS: { key: string; price: number; one: string; many: string; source: string }[] = [
  {
    key: 'iphone',
    price: 11999,
    one: 'iPhone 18 Pro',
    many: 'iPhones 18 Pro',
    source: 'Apple, preço de lançamento no Brasil do iPhone 18 Pro de 256 GB, setembro de 2026',
  },
  {
    key: 'carro',
    price: 72490,
    one: 'carro zero',
    many: 'carros zero',
    source: 'Fiat Mobi Like, o zero mais barato do Brasil, oferta de novembro de 2026',
  },
  {
    key: 'petrobras',
    price: 45.95,
    one: 'ação da Petrobras',
    many: 'ações da Petrobras',
    source: 'B3, PETR4, fechamento de 5 de novembro de 2026',
  },
];

export type Para = 'eu' | 'casa';

export const PARA: { value: Para; label: string; hint: string; icon: IconName }[] = [
  { value: 'eu', label: 'Só para mim', hint: 'O seu dinheiro e as suas contas.', icon: 'wallet' },
  { value: 'casa', label: 'Para mim e minha casa', hint: 'Você cuida das contas da casa no seu celular.', icon: 'home' },
];

/** Como a pessoa conheceu o Baiu. Vai junto com o cadastro, se ela responder. */
export const ORIGENS: { value: string; label: string; icon: IconName }[] = [
  { value: 'instagram', label: 'Instagram', icon: 'share' },
  { value: 'tiktok', label: 'TikTok', icon: 'share' },
  { value: 'youtube', label: 'YouTube', icon: 'share' },
  { value: 'indicacao', label: 'Alguém me indicou', icon: 'chat' },
  { value: 'loja', label: 'Procurando na loja de apps', icon: 'search' },
  { value: 'google', label: 'Pesquisa no Google', icon: 'search' },
  { value: 'outro', label: 'Outro lugar', icon: 'more' },
];

export const IDADE = { min: 18, max: 80, start: 30 };

export type Objetivo = 'reserva' | 'viagem' | 'dividas' | 'investir' | 'casa' | 'estudo';

export const OBJETIVOS: { value: Objetivo; label: string; para: string; icon: IconName }[] = [
  { value: 'reserva', label: 'Uma reserva para emergências', para: 'a sua reserva', icon: 'vault' },
  { value: 'viagem', label: 'Uma viagem', para: 'a sua viagem', icon: 'plane' },
  { value: 'dividas', label: 'Sair das dívidas', para: 'quitar as dívidas', icon: 'receipt' },
  { value: 'investir', label: 'Investir', para: 'investir', icon: 'growth' },
  { value: 'casa', label: 'A casa própria', para: 'a entrada da casa', icon: 'home' },
  { value: 'estudo', label: 'Estudar', para: 'os estudos', icon: 'book' },
];

export type Stat = { value: string; spoken: string; title: string; detail: string; source: string };

/** "Você não está sozinho": muita gente perde dinheiro sem ver. */
export const SOZINHO: Stat[] = [
  {
    value: '48%',
    spoken: '48 por cento',
    title: 'dos brasileiros não controlam o próprio dinheiro',
    detail: '1 em cada 4 confia só na memória para lembrar o que gastou, e 1 em cada 5 não anota nada.',
    source: 'CNDL e SPC Brasil, pesquisa de educação financeira nas 27 capitais, janeiro de 2020.',
  },
  {
    value: '1 em 3',
    spoken: '1 em cada 3',
    title: 'paga por uma assinatura que nem usa',
    detail: 'Em média, são R$ 1.416 por ano em quase 4 serviços.',
    source: 'Bango, pesquisa feita pela 3Gem em abril e maio de 2024.',
  },
];

/** "Não é culpa sua": pagar sem ver o dinheiro faz gastar mais. */
export const CULPA: Stat = {
  value: '2x',
  spoken: 'o dobro',
  title: 'é quanto as pessoas aceitaram pagar com cartão, comparado com dinheiro vivo',
  detail:
    'Num leilão de ingressos feito no MIT, quem ia pagar com cartão ofereceu, em média, mais que o dobro de quem ia pagar em dinheiro. Quando o dinheiro não passa pela mão, o gasto pesa menos. Com Pix, aproximação e compra em um toque, ele sai mais leve ainda.',
  source: 'Drazen Prelec e Duncan Simester, MIT, publicado na Marketing Letters em 2001.',
};

/** Quem enriquece sabe para onde vai o dinheiro. */
export const RICOS: Stat = {
  value: '62%',
  spoken: '62 por cento',
  title: 'dos milionários sabem quanto a família gasta com comida, roupa e moradia',
  detail:
    'Entre quem ganha bem mas não ficou rico, só 35% sabem. Aqui, só 13% das classes A e B estão sem reserva para emergências; nas classes D e E, são 48%.',
  source:
    'Thomas Stanley e William Danko, "O Milionário Mora ao Lado", pesquisa com milionários dos EUA; Anbima e Datafolha, Raio-X do Investidor, 9ª edição (dados de 2025).',
};

/**
 * Relatos de quem usa o Baiu. Só entram relatos reais, com autorização por
 * escrito da pessoa para usar nome e frase. Enquanto a lista estiver vazia, a
 * tela de relatos não aparece.
 */
export const RELATOS: { name: string; city: string; text: string }[] = [];
