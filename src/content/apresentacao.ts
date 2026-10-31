/**
 * Dados da apresentação do primeiro uso. Cada número tem fonte, mês e
 * pesquisa: as lojas e as pessoas cobram que não seja inventado. Ao trocar um
 * número, troque a fonte junto e confira na publicação original. Troque também
 * a INTRO_VERSION (src/lib/intro.ts), para quem já viu ver a versão nova.
 */
export type Stat = {
  /** Número que sobe na tela. */
  value: number;
  /** Como o número aparece ("82%", "84 milhões"...). */
  format: (n: number) => string;
  /** Leitura do número para quem usa leitor de tela. */
  spoken: string;
  title: string;
  detail: string;
  source: string;
  /** Fôlego do Baiu nesta tela: ele murcha a cada dado. */
  score: number;
};

const thousands = (n: number) => Math.round(n).toLocaleString('pt-BR');

export const STATS: Stat[] = [
  {
    value: 48,
    format: (n) => `${Math.round(n)}%`,
    spoken: '48 por cento',
    title: 'dos brasileiros não controlam o próprio dinheiro',
    detail: '1 em cada 4 confia só na memória para lembrar o que gastou, e 1 em cada 5 não anota nada. Você sabe quanto gastou no mês passado?',
    source: 'CNDL e SPC Brasil, pesquisa de educação financeira nas 27 capitais, janeiro de 2020.',
    score: 34,
  },
  {
    value: 62,
    format: (n) => `${Math.round(n)}%`,
    spoken: '62 por cento',
    title: 'dos milionários sabem quanto a família gasta com comida, roupa e moradia',
    detail: 'Entre quem ganha bem mas não ficou rico, só 35% sabem. Aqui, só 13% das classes A e B estão sem reserva para emergências; nas classes D e E, são 48%.',
    source: 'Thomas Stanley e William Danko, "O Milionário Mora ao Lado", pesquisa com milionários dos EUA; Anbima e Datafolha, Raio-X do Investidor, 9ª edição (dados de 2025).',
    score: 68,
  },
  {
    value: 1416,
    format: (n) => `R$ ${thousands(n)}`,
    spoken: '1.416 reais',
    title: 'por ano em assinaturas, em média',
    detail: 'São R$ 118 por mês, em quase 4 serviços. E 1 em cada 3 brasileiros paga por uma assinatura que nem usa.',
    source: 'Bango, pesquisa feita pela 3Gem em abril e maio de 2024.',
    score: 14,
  },
];

/** Quanto pode escapar por mês, na tela "E no seu bolso?". */
export const LEAKS = [50, 100, 200, 300];
export const LEAK_YEARS = 10;
