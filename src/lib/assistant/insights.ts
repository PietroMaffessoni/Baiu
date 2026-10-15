import { CATEGORY, OUT_CATEGORIES } from '@/data/categories';
import type { BillSuggestion, OutCategory, State, Tx } from '@/data/types';
import { round2 } from '../ledger';
import { brl } from '../money';
import { flowsIn } from '../summary';

/**
 * O olho do Baiu: tudo calculado no aparelho, sem internet e sem IA.
 * Agrupa gastos parecidos, reconhece o que se repete todo mês e aponta
 * o que fugiu do normal em relação ao mês passado.
 */

export type RecurringKind = 'conta' | 'fixo' | 'assinatura';
type Family = { key: string; label: string; kind: RecurringKind; words: string[] };

/** Contas de consumo e gastos fixos comuns no Brasil, pelos nomes que aparecem na descrição. */
const FAMILIES: Family[] = [
  {
    key: 'luz',
    label: 'Conta de luz',
    kind: 'conta',
    words: [
      'luz',
      'energia',
      'enel',
      'cemig',
      'copel',
      'cpfl',
      'light',
      'coelba',
      'celpe',
      'cosern',
      'equatorial',
      'neoenergia',
      'eletropaulo',
      'energisa',
      'celesc',
      'edp',
      'ceee',
      'elektro',
    ],
  },
  {
    key: 'agua',
    label: 'Conta de água',
    kind: 'conta',
    words: [
      'agua',
      'sabesp',
      'cedae',
      'copasa',
      'embasa',
      'compesa',
      'sanepar',
      'corsan',
      'caesb',
      'cagece',
      'casan',
      'saneago',
      'cesan',
      'esgoto',
      'aegea',
      'igua',
      'brk',
      'saae',
      'dmae',
    ],
  },
  {
    key: 'gas',
    label: 'Conta de gás',
    kind: 'conta',
    words: ['gas', 'comgas', 'ultragaz', 'liquigas', 'supergasbras', 'copagaz', 'naturgy', 'botijao'],
  },
  {
    key: 'internet',
    label: 'Internet',
    kind: 'conta',
    words: ['internet', 'fibra', 'banda larga', 'claro net', 'net claro', 'tim live', 'brisanet'],
  },
  { key: 'celular', label: 'Celular', kind: 'conta', words: ['celular', 'telefone', 'recarga'] },
  { key: 'aluguel', label: 'Aluguel', kind: 'fixo', words: ['aluguel'] },
  { key: 'condominio', label: 'Condomínio', kind: 'fixo', words: ['condominio'] },
  {
    key: 'plano-saude',
    label: 'Plano de saúde',
    kind: 'fixo',
    words: ['plano de saude', 'unimed', 'amil', 'sulamerica', 'bradesco saude', 'hapvida', 'notredame'],
  },
  {
    key: 'academia',
    label: 'Academia',
    kind: 'assinatura',
    words: ['academia', 'smart fit', 'smartfit', 'bluefit', 'bodytech', 'selfit', 'wellhub', 'gympass', 'totalpass'],
  },
];

const STOP = new Set(
  (
    'de da do das dos e a o as os em no na nos nas para pra por com conta contas pagamento pgto pag compra ' +
    'compras pix boleto debito credito cartao fatura mensal mensalidade valor ref referente meu minha'
  ).split(' '),
);

export function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokensOf(description: string) {
  return normalize(description)
    .split(' ')
    .filter((t) => t.length > 1 && !/\d/.test(t) && !STOP.has(t));
}

function familyOf(tokens: string[]): Family | undefined {
  const joined = ` ${tokens.join(' ')} `;
  return FAMILIES.find((f) => f.words.some((w) => (w.includes(' ') ? joined.includes(` ${w} `) : tokens.includes(w))));
}

/** Chave do grupo: a família (luz, água...) ou a categoria com a primeira palavra útil. */
export function groupKey(description: string, category: string) {
  const tokens = tokensOf(description);
  const family = familyOf(tokens);
  if (family) return { key: `f:${family.key}`, family };
  if (tokens.length === 0) return null;
  return { key: `${category}:${tokens[0]}`, family: undefined };
}

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
const monthStart = (mi: number) => new Date(Math.floor(mi / 12), mi % 12, 1);
const daysIn = (mi: number) => new Date(Math.floor(mi / 12), (mi % 12) + 1, 0).getDate();

export type Group = {
  key: string;
  label: string;
  /** Rótulo genérico ("Açaí", "Posto"), que vai em minúsculas no meio da frase. */
  generic: boolean;
  category: OutCategory;
  kind?: RecurringKind;
  /** Do mais recente ao mais antigo. */
  txs: Tx[];
  /** Total e quantidade por mês (índice ano*12+mês). */
  months: Map<number, { total: number; count: number }>;
};

const isExpense = (t: Tx) => t.kind === 'saida' && t.category !== 'transferencia';

/** Gastos dos últimos seis meses agrupados por "o que é". */
export function expenseGroups(state: State, now = new Date()): Group[] {
  const cur = monthIndex(now);
  const from = monthStart(cur - 5);
  const until = monthStart(cur + 1);
  const groups = new Map<string, Group>();
  for (const t of state.txs) {
    if (!isExpense(t)) continue;
    const d = new Date(t.date);
    if (d < from || d >= until) continue;
    const g = groupKey(t.description, t.category);
    if (!g) continue;
    let group = groups.get(g.key);
    if (!group) {
      group = {
        key: g.key,
        label: g.family?.label ?? '',
        generic: false,
        category: t.category as OutCategory,
        kind: g.family?.kind,
        txs: [],
        months: new Map(),
      };
      groups.set(g.key, group);
    }
    group.txs.push(t);
    const m = group.months.get(monthIndex(d)) ?? { total: 0, count: 0 };
    m.total = round2(m.total + t.amount);
    m.count += 1;
    group.months.set(monthIndex(d), m);
  }
  for (const g of groups.values()) {
    g.txs.sort((a, b) => b.date.localeCompare(a.date));
    if (g.label) continue;
    const latest = g.txs[0].description.trim();
    const distinct = new Set(g.txs.map((t) => normalize(t.description)));
    if (distinct.size === 1) {
      g.label = latest.slice(0, 40);
    } else {
      // descrições diferentes ("Açaí do Zé", "Açaí Concept"): fica a palavra em comum
      const token = g.key.split(':')[1];
      const word = latest.split(/\s+/).find((w) => normalize(w) === token) ?? token;
      g.label = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      g.generic = true;
    }
  }
  return [...groups.values()];
}

export type Recurring = {
  key: string;
  label: string;
  kind: RecurringKind;
  category: OutCategory;
  /** Média por mês nos meses em que apareceu. */
  avg: number;
  last: number;
  lastDate: string;
  /** Dia do mês em que costuma acontecer. */
  day: number;
  /** Em quantos dos últimos quatro meses apareceu. */
  seen: number;
  /** Já existe um vencimento cadastrado para ela. */
  hasBill: boolean;
};

/** Onde um gasto que se repete com o mesmo valor costuma ser fixo. Mercado e delivery não entram. */
const FIXED_CATEGORIES = new Set<string>(['casa', 'contas', 'educacao', 'saude']);

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function similarAmounts(xs: number[]) {
  const m = mean(xs);
  if (m <= 0) return false;
  const sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
  return sd / m <= 0.25;
}

/** Contas, gastos fixos e assinaturas que se repetem mês a mês. */
export function recurring(state: State, now = new Date(), groups = expenseGroups(state, now)): Recurring[] {
  const cur = monthIndex(now);
  const billKeys = new Set(
    state.bills.filter((b) => b.repeatMonthly || !b.paid).map((b) => groupKey(b.title, b.category)?.key),
  );
  const out: Recurring[] = [];
  for (const g of groups) {
    const window = [cur - 3, cur - 2, cur - 1, cur].filter((m) => g.months.has(m));
    const seen = window.length;
    const totals = window.map((m) => g.months.get(m)!.total);
    const perMonth = mean(window.map((m) => g.months.get(m)!.count));
    let kind: RecurringKind | null = null;
    if (g.kind === 'conta' || g.kind === 'fixo') kind = seen >= 2 ? g.kind : null;
    else if (g.kind === 'assinatura' || g.category === 'assinaturas') kind = seen >= 2 ? 'assinatura' : null;
    else if (FIXED_CATEGORIES.has(g.category) && seen >= 3 && perMonth <= 1.5 && similarAmounts(totals)) {
      // mesmo valor todo mês em casa, contas, educação ou saúde: gasto fixo (escola, plano, diarista)
      kind = 'fixo';
    }
    if (!kind) continue;
    const last = g.txs[0];
    out.push({
      key: g.key,
      label: g.label,
      kind,
      category: g.category,
      avg: round2(mean(totals)),
      last: last.amount,
      lastDate: last.date,
      day: new Date(last.date).getDate(),
      seen,
      hasBill: billKeys.has(g.key),
    });
  }
  return out.sort((a, b) => b.avg - a.avg);
}

export type AlertKind = 'item' | 'categoria' | 'conta' | 'ritmo' | 'recorrente';

export type Alert = {
  /** Estável dentro do mês: o mesmo aviso não volta depois de visto. */
  id: string;
  kind: AlertKind;
  title: string;
  /** Fala do Baiu, com valores. */
  text: string;
  /** Texto da notificação, sem valores: ela aparece na tela bloqueada. */
  push: string;
  /** Peso em reais, para ordenar. */
  impact: number;
  ask?: string;
  bill?: BillSuggestion;
};

const lower = (label: string, generic: boolean) => (generic ? label.toLowerCase() : label);
const pctOf = (v: number) => `${Math.round(v * 100)}%`;
const inRange = (t: Tx, from: Date, to: Date) => {
  const d = new Date(t.date);
  return d >= from && d < to;
};
const sum = (txs: Tx[]) => round2(txs.reduce((n, t) => n + t.amount, 0));
const days = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

/** O que fugiu do normal neste mês, do mais pesado ao mais leve. */
export function buildAlerts(state: State, now = new Date()): Alert[] {
  const cur = monthIndex(now);
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const curStart = monthStart(cur);
  const next = monthStart(cur + 1);
  const prevStart = monthStart(cur - 1);
  const day = now.getDate();
  const samePrevEnd = new Date(prevStart.getFullYear(), prevStart.getMonth(), Math.min(day, daysIn(cur - 1)) + 1);

  const groups = expenseGroups(state, now);
  const rec = recurring(state, now, groups);
  const recKeys = new Set(rec.map((r) => r.key));
  const alerts: Alert[] = [];
  // comparar com o mês passado só vale se a pessoa já registrava desde o começo dele
  const first = state.txs.reduce((min, t) => (t.date < min ? t.date : min), '9999');
  const knowsLastMonth = first !== '9999' && new Date(first) <= new Date(prevStart.getTime() + 3 * 86_400_000);

  // 1. um gasto do dia a dia passou do mês passado inteiro ("açaí")
  for (const g of knowsLastMonth ? groups : []) {
    if (g.kind || recKeys.has(g.key) || g.category === 'assinaturas') continue;
    const thisMonth = g.months.get(cur);
    const prev = g.months.get(cur - 1)?.total ?? 0;
    if (!thisMonth || thisMonth.count < 2 || prev < 10) continue;
    const diff = round2(thisMonth.total - prev);
    if (diff < Math.max(20, prev * 0.25)) continue;
    const name = lower(g.label, g.generic);
    alerts.push({
      id: `item:${g.key}:${ym}`,
      kind: 'item',
      title: `${g.label} acima do mês passado`,
      text: `Este mês você já gastou ${brl(diff)} a mais com ${name} do que no mês passado inteiro: ${brl(thisMonth.total)} até agora, contra ${brl(prev)}.`,
      push: `Você já gastou mais com ${name} do que no mês passado inteiro.`,
      impact: diff,
      ask: `Como posso gastar menos com ${name}?`,
    });
  }

  // 2. uma categoria acelerou em relação ao mesmo ponto do mês passado
  const variable = state.txs.filter((t) => {
    if (!isExpense(t) || t.billId) return false;
    const k = groupKey(t.description, t.category);
    return !k || (!k.family && !recKeys.has(k.key));
  });
  for (const cat of knowsLastMonth ? OUT_CATEGORIES : []) {
    const txs = variable.filter((t) => t.category === cat);
    const curTxs = txs.filter((t) => inRange(t, curStart, next));
    const nowSum = sum(curTxs);
    const prevSum = sum(txs.filter((t) => inRange(t, prevStart, samePrevEnd)));
    const diff = round2(nowSum - prevSum);
    if (day < 3 || curTxs.length < 3 || prevSum < 50 || diff < Math.max(80, prevSum * 0.3)) continue;
    const explained = alerts
      .filter((a) => a.kind === 'item' && a.id.startsWith(`item:${cat}:`))
      .reduce((n, a) => n + a.impact, 0);
    if (explained >= diff * 0.5) continue;
    const name = CATEGORY[cat].label.toLowerCase();
    alerts.push({
      id: `categoria:${cat}:${ym}`,
      kind: 'categoria',
      title: `${CATEGORY[cat].label} acima do normal`,
      text: `Com ${name} você gastou ${brl(diff)} a mais do que até o dia ${day} do mês passado: ${brl(nowSum)} contra ${brl(prevSum)}.`,
      push: `Seus gastos com ${name} estão acima do mês passado.`,
      impact: diff,
      ask: `Onde posso economizar com ${name}?`,
    });
  }

  // 3. conta de consumo acima da média, ou assinatura que subiu de preço
  const byKey = new Map(groups.map((g) => [g.key, g]));
  for (const r of rec) {
    const g = byKey.get(r.key)!;
    const thisMonth = g.months.get(cur);
    if (!thisMonth) continue;
    if (r.kind === 'assinatura') {
      const prev = g.months.get(cur - 1);
      if (!prev || prev.count !== 1 || thisMonth.count !== 1) continue;
      const diff = round2(thisMonth.total - prev.total);
      if (diff < Math.max(2, prev.total * 0.05)) continue;
      alerts.push({
        id: `conta:${r.key}:${ym}`,
        kind: 'conta',
        title: `${r.label} ficou mais cara`,
        text: `${r.label} subiu de ${brl(prev.total)} para ${brl(thisMonth.total)} este mês. Em um ano, são ${brl(diff * 12)} a mais.`,
        push: `${r.label} ficou mais cara este mês.`,
        impact: diff * 12,
        ask: `Vale a pena manter ${r.label}?`,
      });
      continue;
    }
    const before = [cur - 3, cur - 2, cur - 1].map((m) => g.months.get(m)?.total).filter((v): v is number => !!v);
    if (before.length === 0) continue;
    const avg = round2(mean(before));
    const diff = round2(thisMonth.total - avg);
    if (diff < Math.max(15, avg * 0.15)) continue;
    alerts.push({
      id: `conta:${r.key}:${ym}`,
      kind: 'conta',
      title: `${r.label} acima da média`,
      text: `${r.label} deste mês veio ${brl(diff)} acima da média dos meses anteriores: ${brl(thisMonth.total)} contra ${brl(avg)}, ${pctOf(diff / avg)} a mais.`,
      push: `${r.label} deste mês veio acima da média.`,
      impact: diff,
      ask: `Como posso pagar menos de ${r.label.toLowerCase()}?`,
    });
  }

  // 4. o mês como um todo
  const month = flowsIn(state, { start: curStart, end: next });
  const prevMonth = flowsIn(state, { start: prevStart, end: curStart });
  const left = daysIn(cur) - day;
  if (month.entradas > 0 && month.gastos >= month.entradas * 0.9 && day >= 5) {
    alerts.push({
      id: `ritmo:entradas:${ym}`,
      kind: 'ritmo',
      title: 'Gastos perto do que entrou',
      text: `Neste mês você já gastou ${pctOf(month.gastos / month.entradas)} do que entrou: ${brl(month.gastos)} de ${brl(month.entradas)}.${left > 0 ? ` Ainda faltam ${days(left)} para o mês acabar.` : ''}`,
      push: 'Seus gastos do mês já chegaram perto do que entrou.',
      impact: month.gastos - month.entradas * 0.8,
      ask: 'O que eu faço para fechar o mês no azul?',
    });
  } else if (knowsLastMonth && prevMonth.gastos > 0 && month.gastos > prevMonth.gastos && left > 0) {
    const diff = round2(month.gastos - prevMonth.gastos);
    alerts.push({
      id: `ritmo:mes:${ym}`,
      kind: 'ritmo',
      title: 'Mês mais caro que o anterior',
      text: `Você já gastou ${brl(month.gastos)} neste mês, ${brl(diff)} a mais do que no mês passado inteiro, e ainda faltam ${days(left)}.`,
      push: 'Você já gastou mais neste mês do que no mês passado inteiro.',
      impact: diff,
      ask: 'Onde eu mais gastei este mês?',
    });
  }

  // 5. conta que se repete e ainda não tem lembrete
  for (const r of rec) {
    if (r.hasBill || r.kind === 'assinatura') continue;
    alerts.push({
      id: `recorrente:${r.key}`,
      kind: 'recorrente',
      title: `${r.label} se repete todo mês`,
      text: `Reconheci que ${r.label.toLowerCase()} se repete todo mês, em média ${brl(r.avg)}, perto do dia ${r.day}. Quer que eu lembre do vencimento?`,
      push: 'O Baiu reconheceu uma conta que se repete todo mês.',
      impact: r.avg * 0.5,
      bill: { title: r.label, amount: r.last, category: r.category, day: r.day },
    });
  }

  return alerts.sort((a, b) => b.impact - a.impact).slice(0, 6);
}

/** Avisos que a pessoa ainda não viu. */
export function unseenAlerts(state: State, now = new Date()) {
  return buildAlerts(state, now).filter((a) => !state.assistant.seen[a.id]);
}
