/**
 * Dados da apresentação do primeiro uso. Cada número tem fonte, mês e
 * pesquisa: as lojas e as pessoas cobram que não seja inventado. Ao trocar um
 * número, troque a fonte junto e confira na publicação original.
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
    value: 82,
    format: (n) => `${Math.round(n)}%`,
    spoken: '82 por cento',
    title: 'das famílias brasileiras têm dívidas',
    detail: 'Cartão, carnê, empréstimo, financiamento: 8 em cada 10 famílias começam o mês devendo. E 3 em cada 10 têm contas em atraso.',
    source: 'CNC, Pesquisa de Endividamento e Inadimplência do Consumidor (Peic), agosto de 2026.',
    score: 46,
  },
  {
    value: 84,
    format: (n) => `${Math.round(n)} milhões`,
    spoken: '84 milhões',
    title: 'de brasileiros estão com o nome negativado',
    detail: 'Uma conta atrasada vira juros, que viram outra conta atrasada.',
    source: 'Serasa, Mapa da Inadimplência, agosto de 2026 (83,98 milhões).',
    score: 30,
  },
  {
    value: 63,
    format: (n) => `${Math.round(n)}%`,
    spoken: '63 por cento',
    title: 'não têm reserva suficiente para emergências',
    detail: '31% não têm nenhum dinheiro guardado. Basta um imprevisto para a conta ir parar no cartão.',
    source: 'Anbima e Datafolha, Raio-X do Investidor, 9ª edição, com dados de 2025 (31% sem reserva e 32% com menos do que o recomendado).',
    score: 18,
  },
  {
    value: 1416,
    format: (n) => `R$ ${thousands(n)}`,
    spoken: '1.416 reais',
    title: 'por ano em assinaturas, em média',
    detail: 'São R$ 118 por mês, em quase 4 serviços. E 1 em cada 3 brasileiros paga por uma assinatura que nem usa.',
    source: 'Bango, pesquisa feita pela 3Gem em abril e maio de 2024.',
    score: 8,
  },
];

/** Quanto pode escapar por mês, na tela "E no seu bolso?". */
export const LEAKS = [50, 100, 200, 300];
export const LEAK_YEARS = 10;
