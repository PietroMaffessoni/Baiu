import { IN_CATEGORIES, OUT_CATEGORIES } from '@/data/categories';
import type { Category, InCategory, OutCategory, Tx } from '@/data/types';
import { normalize } from '../assistant/insights';
import type { RemoteTx } from './types';

/**
 * Categoria automática dos movimentos que vêm do banco, em camadas:
 * 1. o que a pessoa já corrigiu antes (regras aprendidas);
 * 2. dinheiro que só muda de lugar (fatura, Pix para si, aplicação, resgate);
 * 3. a categoria do provedor (a da Polp, ou a antiga em inglês);
 * 4. um dicionário de lojas e serviços brasileiros;
 * 5. sem certeza: vai para "Confira", para a pessoa olhar.
 */

export type Internal = 'fatura' | 'mesma-pessoa' | 'aplicacao' | 'resgate';

export type Guess = {
  kind: 'entrada' | 'saida';
  category: Category;
  review: boolean;
  by: NonNullable<Tx['catBy']>;
  internal?: Internal;
};

const STOP = new Set(
  (
    'de da do das dos e a o em no na para pra por com compra compras pagamento pgto pag pix ted doc boleto ' +
    'debito credito cartao transf transferencia enviado enviada recebido recebida via sa ltda me eireli'
  ).split(' '),
);

/** Chave de um gasto para regras aprendidas: as duas primeiras palavras úteis da descrição. */
export function ruleKey(description: string): string | null {
  const tokens = normalize(description)
    .split(' ')
    .filter((t) => t.length > 1 && !/\d/.test(t) && !STOP.has(t));
  return tokens.length ? tokens.slice(0, 2).join(' ') : null;
}

const has = (text: string, re: RegExp) => re.test(text);

/** Categoria antiga do provedor (em inglês) -> categoria do Baiu. */
const PROVIDER: [RegExp, OutCategory | InCategory][] = [
  [/^(salary|retirement|salario|aposentadoria)$/, 'salario'],
  [/^(entrepreneurial activities)$/, 'renda_extra'],
  [/^(government aid|non-recurring income|income)$/, 'outras_entradas'],
  [/^(groceries|supermarket|supermercado)/, 'mercado'],
  [/^(eating out|food delivery|food and drinks|restaurants?|alimentacao)/, 'alimentacao'],
  [/^(pet supplies|pet)/, 'pets'],
  [/^(gaming)$/, 'lazer'],
  [/^(digital services|video streaming|music streaming|streaming)/, 'assinaturas'],
  [/^(wellness and fitness|healthcare|dentist|pharmacy|optometry|hospital|health insurance)/, 'saude'],
  [/^(education)/, 'educacao'],
  [/^(tickets|leisure|entertainment)/, 'lazer'],
  [/^(utilities|water|electricity|gas$|telecommunications|internet|mobile|tv$)/, 'contas'],
  [/^(housing|rent|houseware|urban land and building tax)/, 'casa'],
  [
    /^(transportation|taxi|public transportation|car rental|bicycle|automotive|gas stations|parking|tolls|vehicle)/,
    'transporte',
  ],
  [/^(travel|airport|accommodation|mileage|bus tickets)/, 'viagem'],
  [/^(shopping|online shopping|electronics|clothing|kids and toys|bookstore)/, 'compras'],
  [
    /^(taxes|income taxes|tax on|bank fees|account fees|wire transfer fees|credit card fees|insurance|life|home|vehicle insurance)/,
    'contas',
  ],
];

/** Lojas, serviços e palavras comuns em extratos brasileiros. A primeira que bater vale. */
const WORDS: [RegExp, OutCategory][] = [
  [
    /\b(netflix|spotify|disney|prime video|amazon prime|hbo|max com|youtube premium|globoplay|deezer|paramount|crunchyroll|apple com bill|google one|icloud|chatgpt|openai|canva|microsoft 365|assinatura)\b/,
    'assinaturas',
  ],
  [
    /\b(ifood|uber eats|rappi|ze delivery|restaurante|lanchonete|padaria|pizzaria|hamburgueria|burger|mc ?donald|bk|subway|acai|cafe|cafeteria|starbucks|boteco|sorveteria|churrascaria|outback|coco bambu|habibs|spoleto|giraffas)\b/,
    'alimentacao',
  ],
  [
    /\b(supermercado|mercado(?! ?livre| ?pago)|mercadinho|atacadao|atacadista|assai|carrefour|pao de acucar|extra hiper|dia brasil|sams club|makro|hortifruti|sacolao|guanabara|zaffari|savegnago|condor|angeloni|big bompreco|nagumo|tenda atacado)\b/,
    'mercado',
  ],
  [
    /\b(uber|99 ?app|99 ?pop|99 ?taxi|cabify|posto|combustivel|gasolina|shell|ipiranga|petrobras|br mania|estacionamento|estapar|sem parar|veloe|conectcar|move mais|metro|cptm|bilhete unico|onibus|pedagio|oficina|autopecas|detran|ipva|licenciamento)\b/,
    'transporte',
  ],
  [
    /\b(enel|light|cemig|copel|cpfl|coelba|celpe|equatorial|neoenergia|energisa|sabesp|cedae|copasa|embasa|sanepar|corsan|comgas|naturgy|ultragaz|liquigas|vivo|claro|tim|oi fibra|net servicos|sky|conta de luz|conta de agua|energia eletrica|telefonia|tarifa|anuidade|iof|juros|encargos)\b/,
    'contas',
  ],
  [
    /\b(aluguel|condominio|iptu|imobiliaria|quintoandar|leroy merlin|telhanorte|tok ?stok|etna|camicado|madeiramadeira|diarista)\b/,
    'casa',
  ],
  [
    /\b(drogasil|droga raia|raia|pague menos|panvel|drogaria|farmacia|hospital|laboratorio|clinica|consulta|dentista|odonto|unimed|amil|hapvida|sulamerica|smart ?fit|bluefit|academia|bodytech|wellhub|gympass|totalpass|psicolog)\b/,
    'saude',
  ],
  [
    /\b(escola|colegio|faculdade|universidade|mensalidade escolar|curso|udemy|alura|coursera|duolingo|livraria|saraiva|material escolar)\b/,
    'educacao',
  ],
  [/\b(petz|cobasi|petshop|pet shop|veterinari|racao|petlove)\b/, 'pets'],
  [
    /\b(latam|gol linhas|voegol|azul linhas|voeazul|airbnb|booking|hotel|pousada|decolar|123 ?milhas|maxmilhas|clickbus|rodoviaria|buser|hostel)\b/,
    'viagem',
  ],
  [
    /\b(cinema|cinemark|ingresso|sympla|eventim|teatro|show|parque|steam|playstation|psn|xbox|nintendo|riot|epic games|bilheteria|clube)\b/,
    'lazer',
  ],
  [
    /\b(mercado ?livre|mercadolivre|amazon|shopee|magalu|magazine luiza|americanas|aliexpress|shein|renner|riachuelo|cea|zara|centauro|netshoes|kabum|casas bahia|ponto frio|fast shop|decathlon|havan|leroy|loja)\b/,
    'compras',
  ],
];

const SALARY =
  /\b(salario|folha|remuneracao|pagto func|pagamento de salario|13 salario|decimo terceiro|ferias|adiantamento salarial|vencimentos)\b/;
const YIELD = /\b(rendimento|rend pago|juros sobre capital|jcp|dividendo|remuneracao aplicacao)\b/;
const REFUND = /\b(estorno|reembolso|devolucao|cashback|chargeback)\b/;
const CARD_BILL =
  /\b(pagamento (de )?fatura|pagto fatura|pag fatura|fatura (do )?cartao|pagamento recebido|pagamento cartao)\b/;
const INVEST_OUT =
  /\b(aplicacao|aplic|investimento|caixinha|cofrinho|porquinho|guardar dinheiro|tesouro direto|compra de titulo)\b/;
const INVEST_IN = /\b(resgate|resg|retirada caixinha|venda de titulo)\b/;

type ProviderGuess = OutCategory | InCategory | 'transfer' | 'same' | 'invest' | 'bill';

/**
 * Categoria da Polp (taxonomia em códigos, como "FOOD_AND_DRINK_GROCERIES") ->
 * categoria do Baiu. A primeira que bater vale; vale o começo do código.
 */
const POLP: [RegExp, ProviderGuess][] = [
  [/^INCOME_(SALARY|RETIREMENT_PENSION|MILITARY)$/, 'salario'],
  [/^INCOME_(CONTRACTOR|GIG_ECONOMY|RENTAL)$/, 'renda_extra'],
  [/^INCOME_(DIVIDENDS|INTEREST_EARNED)$/, 'rendimento'],
  [/^INCOME_TAX_REFUND$/, 'reembolso'],
  [/^INCOME/, 'outras_entradas'],
  [/^TRANSFER_(IN|OUT)_ACCOUNT_TRANSFER$/, 'same'],
  [/^TRANSFER_(IN|OUT)_(INVESTMENT_AND_RETIREMENT_FUNDS|SAVINGS)$/, 'invest'],
  [/^TRANSFER_/, 'transfer'],
  [/^LOAN_PAYMENTS_CREDIT_CARD_PAYMENT$/, 'bill'],
  [/^LOAN_DISBURSEMENTS/, 'outras_entradas'],
  [/^(LOAN_PAYMENTS|BANK_FEES|GOVERNMENT_AND_NON_PROFIT)/, 'contas'],
  [/^ENTERTAINMENT_(TV_AND_MOVIES|MUSIC_AND_AUDIO)$/, 'assinaturas'],
  [/^ENTERTAINMENT/, 'lazer'],
  [/^(FOOD_AND_DRINK_GROCERIES|GENERAL_MERCHANDISE_SUPERSTORES)$/, 'mercado'],
  [/^FOOD_AND_DRINK/, 'alimentacao'],
  [/^(GENERAL_MERCHANDISE_PET_SUPPLIES|MEDICAL_VETERINARY_SERVICES)$/, 'pets'],
  [/^GENERAL_MERCHANDISE/, 'compras'],
  [/^HOME_IMPROVEMENT/, 'casa'],
  [/^(MEDICAL|PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS)/, 'saude'],
  [/^PERSONAL_CARE/, 'compras'],
  [/^GENERAL_SERVICES_(EDUCATION|CHILDCARE)$/, 'educacao'],
  [/^GENERAL_SERVICES_AUTOMOTIVE$/, 'transporte'],
  [/^GENERAL_SERVICES/, 'contas'],
  [/^TRANSPORTATION/, 'transporte'],
  [/^TRAVEL/, 'viagem'],
  [/^RENT_AND_UTILITIES_RENT$/, 'casa'],
  [/^RENT_AND_UTILITIES/, 'contas'],
];

/** Categorias da Polp largas demais: o dicionário de lojas decide antes (cinema não é assinatura). */
const SOFT = /^ENTERTAINMENT_(TV_AND_MOVIES|MUSIC_AND_AUDIO)$/;

function provider(category: string | null | undefined): ProviderGuess | null {
  if (!category) return null;
  if (/^[A-Z][A-Z_]+$/.test(category)) return POLP.find(([re]) => re.test(category))?.[1] ?? null;
  const c = normalize(category);
  if (/^same person transfer/.test(c)) return 'same';
  if (/^credit card payment/.test(c)) return 'bill';
  if (/^(investments?|automatic investment|fixed income|mutual funds|variable income|margin|pension)/.test(c))
    return 'invest';
  if (/^(transfers?|transfer )/.test(c) || /third party/.test(c)) return 'transfer';
  for (const [re, cat] of PROVIDER) if (re.test(c)) return cat;
  return null;
}

const isIn = (c: Category): c is InCategory => (IN_CATEGORIES as Category[]).includes(c);
const isOut = (c: Category): c is OutCategory => (OUT_CATEGORIES as Category[]).includes(c);

export function categorize(
  tx: Pick<RemoteTx, 'description' | 'type' | 'category' | 'operationType' | 'party'>,
  accountType: 'BANK' | 'CREDIT',
  rules: Record<string, Category> = {},
): Guess {
  const kind = tx.type === 'CREDIT' ? 'entrada' : 'saida';
  const text = normalize(tx.description);
  const op = (tx.operationType ?? '').toUpperCase();
  const prov = provider(tx.category);
  const provCat = prov && !['transfer', 'same', 'invest', 'bill'].includes(prov) ? (prov as Category) : null;
  const neutral = (internal: Internal): Guess => ({
    kind,
    category: 'transferencia',
    review: false,
    by: 'baiu',
    internal,
  });

  // 1. o que a pessoa já ensinou
  const key = ruleKey(tx.description);
  const learned = key ? rules[key] : undefined;
  if (learned && (kind === 'entrada' ? isIn(learned) : isOut(learned))) {
    return { kind, category: learned, review: false, by: 'aprendida' };
  }

  // 2. dinheiro que só muda de lugar
  if (prov === 'bill' || op === 'PAGAMENTO_FATURA' || has(text, CARD_BILL)) {
    if (!(accountType === 'CREDIT' && kind === 'saida')) return neutral('fatura');
  }
  if (prov === 'same') return neutral('mesma-pessoa');
  if (op === 'RENDIMENTO_APLIC_FINANCEIRA' || (kind === 'entrada' && has(text, YIELD))) {
    return { kind: 'entrada', category: 'rendimento', review: false, by: 'baiu' };
  }
  if (accountType === 'BANK') {
    if (kind === 'saida' && (prov === 'invest' || has(text, INVEST_OUT))) return neutral('aplicacao');
    if (kind === 'entrada' && (op === 'RESGATE_APLIC_FINANCEIRA' || prov === 'invest' || has(text, INVEST_IN))) {
      return neutral('resgate');
    }
  }

  // 3 e 4. entradas
  if (kind === 'entrada') {
    if (prov === 'salario' || op === 'FOLHA_PAGAMENTO' || op === 'PORTABILIDADE_SALARIO' || has(text, SALARY)) {
      return { kind, category: 'salario', review: false, by: prov === 'salario' ? 'banco' : 'baiu' };
    }
    if (op === 'ESTORNO' || op === 'CASHBACK' || has(text, REFUND) || accountType === 'CREDIT') {
      return { kind, category: 'reembolso', review: false, by: 'baiu' };
    }
    if (provCat && isIn(provCat)) {
      return { kind, category: provCat, review: provCat === 'outras_entradas', by: 'banco' };
    }
    // Pix ou TED de alguém: pode ser freela, presente, reembolso... a pessoa confirma
    return { kind, category: tx.party === 'cnpj' ? 'renda_extra' : 'outras_entradas', review: true, by: 'baiu' };
  }

  // 3 e 4. saídas
  const soft = SOFT.test(tx.category ?? '');
  if (provCat && isOut(provCat) && !soft) return { kind, category: provCat, review: false, by: 'banco' };
  for (const [re, cat] of WORDS) if (re.test(text)) return { kind, category: cat, review: false, by: 'baiu' };
  if (provCat && isOut(provCat)) return { kind, category: provCat, review: false, by: 'banco' };
  if (['TARIFA', 'PACOTE_TARIFA_SERVICOS', 'TARIFA_SERVICOS_AVULSOS', 'ENCARGOS_JUROS_CHEQUE_ESPECIAL'].includes(op)) {
    return { kind, category: 'contas', review: false, by: 'baiu' };
  }
  if (op === 'CONVENIO_ARRECADACAO') return { kind, category: 'contas', review: true, by: 'baiu' };

  // 5. sem certeza
  return { kind, category: 'outros', review: true, by: 'baiu' };
}

/** Descrição mais legível: sem espaços repetidos e sem tudo em maiúsculas. */
export function tidyDescription(raw: string) {
  const d = raw.replace(/\s+/g, ' ').trim();
  if (!d) return 'Movimento';
  if (d !== d.toUpperCase()) return d.slice(0, 80);
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'para', 'com']);
  return d
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && small.has(w) ? w : w.replace(/\p{L}/u, (c) => c.toUpperCase())))
    .join(' ')
    .slice(0, 80);
}
