import type { State } from '@/data/types';
import { MESES_CURTOS, startOfDay, addDays } from './dates';
import type { Folego } from './folego';
import { flowsIn, monthPeriod, monthlyAportes } from './summary';

export type SealDef = {
  id: string;
  lines: [string, string?];
  title: string;
  how: string;
  earned: boolean;
  date?: string;
};

type Rule = { id: string; lines: [string, string?]; title: string; how: string; test: (ctx: Ctx) => boolean };

type Ctx = { state: State; folego: Folego; now: Date };

const RULES: Rule[] = [
  {
    id: 'primeira-conta',
    lines: ['1ª', 'conta'],
    title: 'Primeira conta',
    how: 'Cadastre a primeira conta no Baiu.',
    test: ({ state }) => state.accounts.length > 0,
  },
  {
    id: 'mes-azul',
    lines: ['Mês no', 'azul'],
    title: 'Mês no azul',
    how: 'Feche um mês gastando menos do que entrou.',
    test: ({ state, now }) => {
      const f = flowsIn(state, monthPeriod(-1, now));
      return f.entradas > 0 && f.gastos < f.entradas;
    },
  },
  {
    id: 'em-dia',
    lines: ['Em', 'dia'],
    title: 'Tudo em dia',
    how: 'Pague três vencimentos até a data.',
    test: ({ state }) =>
      state.bills.filter((b) => b.paid && b.paidAt && new Date(b.paidAt) < addDays(startOfDay(new Date(b.dueDate)), 1))
        .length >= 3,
  },
  {
    id: 'reserva-1',
    lines: ['Reserva', '1 mês'],
    title: 'Reserva de 1 mês',
    how: 'Guarde o equivalente a um mês de gastos.',
    test: ({ folego }) => folego.meses >= 1,
  },
  {
    id: 'constancia-3',
    lines: ['Aporte', '3 meses'],
    title: 'Três meses investindo',
    how: 'Invista algum valor por três meses seguidos.',
    test: ({ state, now }) => monthlyAportes(state, now, 3).every((m) => m.value > 0),
  },
  {
    id: 'reserva-3',
    lines: ['Reserva', '3 meses'],
    title: 'Reserva de 3 meses',
    how: 'Guarde o equivalente a três meses de gastos.',
    test: ({ folego }) => folego.meses >= 3,
  },
  {
    id: 'estufado',
    lines: ['Baiu', 'estufado'],
    title: 'Baiu estufado',
    how: 'Chegue a 75 de fôlego.',
    test: ({ folego }) => folego.score >= 75,
  },
  {
    id: 'reserva-6',
    lines: ['Reserva', '6 meses'],
    title: 'Reserva completa',
    how: 'Guarde seis meses de gastos.',
    test: ({ folego }) => folego.meses >= 6,
  },
  {
    id: 'constancia-12',
    lines: ['Aporte', '12 meses'],
    title: 'Um ano investindo',
    how: 'Invista por doze meses seguidos.',
    test: ({ state, now }) => monthlyAportes(state, now, 12).every((m) => m.value > 0),
  },
];

/** Selos cujas condições valem agora e ainda não foram carimbados. */
export function newlyEarned(state: State, folego: Folego, now = new Date()) {
  const ctx = { state, folego, now };
  return RULES.filter((r) => !state.seals[r.id] && r.test(ctx)).map((r) => r.id);
}

function tag(iso: string) {
  const d = new Date(iso);
  return `${MESES_CURTOS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

/** Selos para exibir: carimbados mantêm a data em que foram conquistados. */
export function sealsFor(state: State): SealDef[] {
  return RULES.map((r) => {
    const at = state.seals[r.id];
    return { id: r.id, lines: r.lines, title: r.title, how: r.how, earned: !!at, date: at ? tag(at) : undefined };
  });
}
