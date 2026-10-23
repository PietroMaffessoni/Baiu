/**
 * Textos da autorização do Open Finance. Vêm do manual da Polp
 * (polp.com.br/docs/celcoin/termos), que segue as regras do Banco Central:
 * os marcados como "texto fixo" não podem ser reescritos, só posicionados.
 * A Celcoin é a instituição regulada que recebe os dados; a Polp faz a ponte.
 */

/** Categorias de dados que o Baiu pede aos bancos. A função `bank` pede exatamente estas. */
export const PRODUCTS = ['ACCOUNT', 'CREDIT_CARD_ACCOUNT', 'INVESTMENTS'] as const;

/** Nome visível e descrição completa de cada categoria (etapas 3.2 e 3.3 do manual). */
export const CATEGORIES: Record<string, { label: string; short: string; details: string }> = {
  ACCOUNT: {
    label: 'Dados da conta',
    short: 'Dados da conta',
    details:
      'Informações da conta, saldo disponível, saldo bloqueado, outros saldos, limite utilizado, limite contratado de cheque especial, detalhes da transação.',
  },
  CREDIT_CARD_ACCOUNT: {
    label: 'Cartão de crédito',
    short: 'Cartão de crédito',
    details:
      'Informações do cartão, informações sobre o limite do cartão, limite total, limite utilizado, limite disponível, limite por tipo de crédito, identificação de transação, valor da transação, datas, identificação do estabelecimento, bandeira do cartão, informações da fatura, encargos e formas de pagamento.',
  },
  INVESTMENTS: {
    label: 'Dados de investimento',
    short: 'Investimentos',
    details:
      'Identificação do produto, informações de remuneração, data de emissão, vencimento, aquisição, data fim da carência, saldo bloqueado, líquido e bruto, quantidade de títulos, preço unitário, impostos provisionados, multa e mora, indexadores, código ISIN, Classificação ANBIMA, Classe e Subclasse de Contratos de renda fixa, renda variável, tesouro direto e fundos de investimentos.',
  },
  CREDIT_OPERATIONS: {
    label: 'Operações de Crédito',
    short: 'Crédito',
    details:
      'Dados do contrato, data da contratação, data do recebimento do crédito, valor do crédito, data de vencimento, datas de pagamento das parcelas, período recorrente dos pagamentos, datas de vencimento de cada parcela, data de vencimento da primeira parcela, saldo devedor, prazo total, prazo remanescente, quantidade de prestações, prestações, taxas de juros, Custo Efetivo Total, sistema de amortização, tarifas, sigla identificadora da tarifa, valor da tarifa, moeda, data da cobrança de tarifa, encargos, garantias, número do documento da instituição consignante.',
  },
  EXCHANGE: {
    label: 'Operações de Câmbio',
    short: 'Câmbio',
    details:
      'Identificação da operação, data do fechamento do contrato de câmbio, data em que a operação (compra ou venda) está prevista para ser liquidada, valor da taxa de câmbio aplicada ao contrato, valor do saldo da operação a liquidar, percentual do valor concedido ao cliente antecipadamente, natureza fato do fechamento da operação, relação de vínculo entre o Cliente e o Pagador/Recebedor no Exterior.',
  },
};

/** Finalidades do compartilhamento: a lista completa é obrigatória (etapa 3.5). */
export const PURPOSES = [
  'Verificação antifraude e validação de identidade e cadastro',
  'Agregação e gestão de dados pessoais',
  'Avaliação de risco, inclusive de crédito',
  'Avaliação de perfil e de padrões de consumo do usuário',
  'Desenvolvimento, atualização, otimização e implementação de medidas de prevenção e segurança',
  'Desenvolvimento de estudos, pesquisas, campanhas, serviços e produtos',
  'Cumprimento de obrigações legais',
  'Comunicação com o usuário',
  'Proteção dos direitos do usuário',
];

/** Hoje a Polp só cria autorizações por prazo indeterminado (etapa 3.6). */
export const TERM = 'Prazo indeterminado: até você cancelar';

/** Documentos da Celcoin citados no Disclaimer #1. */
export const CELCOIN_LINKS = {
  terms: 'https://drive.google.com/file/d/11H_jnnBRYSJcAgh9sgUCjPhXH2-7FoNj/view',
  privacy: 'https://www.celcoin.com.br/wp-content/uploads/2026/07/2026_V6.0_NORMA_DE_PRIVACIDADE_EXTERNA.pdf',
  compliance: 'https://www.celcoin.com.br/compliance-e-regulatorio/',
};

/**
 * Disclaimer #1 (texto fixo), em pedaços: os que têm `link` viram links para
 * os documentos da Celcoin.
 */
export const DISCLAIMER_1: { text: string; link?: keyof typeof CELCOIN_LINKS }[] = [
  { text: 'Ao continuar, você declara que concorda com os ' },
  { text: 'Termos de Uso', link: 'terms' },
  { text: ' e que leu e compreendeu a ' },
  { text: 'Norma de Privacidade Externa', link: 'privacy' },
  { text: ' da Celcoin, em conformidade com as diretrizes de ' },
  { text: 'Compliance e Regulatório', link: 'compliance' },
  { text: '.' },
];

/** Disclaimer #2 (texto fixo; só o nome do botão muda). "Portal" é a área Bancos conectados do Baiu. */
export const disclaimer2 = (button: string) =>
  `Ao clicar em ${button}, você autoriza a Celcoin Instituição de Pagamento Ltda. a acessar informações disponíveis no Open Finance de acordo com os Termos de Uso apresentados nas telas anteriores. Você poderá revogar o compartilhamento através do Portal.`;

const joinOr = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} ou ${names[names.length - 1]}`;

/** Disclaimer #3 (texto fixo; as categorias são só as pedidas). */
export const disclaimer3 = (products: readonly string[]) =>
  `Caso sejam criadas novas operações de ${joinOr(products.map((p) => CATEGORIES[p]?.short ?? p))}, os recursos serão automaticamente inclusos no compartilhamento de dados`;

/** Aviso de redirecionamento: precisa falar em segurança (etapa 4). */
export const REDIRECT_NOTICE = 'Você será redirecionado pela Celcoin com a segurança do Open Finance.';
export const redirectSteps = (bank: string) => [
  `Redirecionamento da Celcoin para ${bank}`,
  `Autenticação em ${bank}`,
  'Redirecionamento da instituição transmissora para a Celcoin',
];
export const IOS_HIDDEN_APP =
  'Antes de ir para o banco, certifique-se de que o aplicativo está instalado e não está no modo "Ocultar e exigir Face ID".';

/** Situação de cada autorização, como aparece no histórico. */
export const CONSENT_STATUS: Record<string, { label: string; tone: 'jade' | 'lantern' | 'vermilion' | 'ink3' }> = {
  autorizada: { label: 'Ativa', tone: 'jade' },
  pendente: { label: 'Aguardando autorização no banco', tone: 'lantern' },
  recusada: { label: 'Recusada no banco', tone: 'vermilion' },
  vencida: { label: 'Vencida: precisa reconectar', tone: 'vermilion' },
  cancelada: { label: 'Cancelada', tone: 'ink3' },
};
