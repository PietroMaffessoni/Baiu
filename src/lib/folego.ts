import type { State } from '@/data/types';
import { brl } from './money';
import { summarize } from './summary';

export type Mood = 'murcho' | 'meio' | 'cheio' | 'estufado';

export const MOODS: { mood: Mood; from: number; label: string; line: string }[] = [
  { mood: 'murcho', from: 0, label: 'Murcho', line: 'O Baiu está murcho' },
  { mood: 'meio', from: 25, label: 'Meio cheio', line: 'O Baiu está meio cheio' },
  { mood: 'cheio', from: 50, label: 'Cheio', line: 'O Baiu está cheio' },
  { mood: 'estufado', from: 75, label: 'Estufado', line: 'O Baiu está estufado' },
];

export function moodOf(score: number): (typeof MOODS)[number] {
  let found = MOODS[0];
  for (const m of MOODS) if (score >= m.from) found = m;
  return found;
}

export type PillarKey = 'fluxo' | 'reserva' | 'emdia' | 'constancia';

export type Pillar = {
  key: PillarKey;
  title: string;
  rule: string;
  detail: string;
  points: number;
  max: 25;
};

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/**
 * Fôlego: quatro pilares de 25 pontos, cada um com uma regra que cabe numa frase.
 * O tamanho e o humor do Baiu leem só este número.
 */
export function computeFolego(state: State, now = new Date()) {
  const s = summarize(state, now);

  const ratio = s.entradas > 0 ? s.gastos / s.entradas : 1;
  const fluxo = clamp((0.9 - ratio) / 0.3) * 25;

  const gastoMensal = Math.max(s.gastos, 1);
  const meses = s.reserva / gastoMensal;
  const reserva = clamp(meses / 6) * 25;

  const atrasadas = state.bills.filter((b) => !b.paid && new Date(b.dueDate) < now);
  const emdia = clamp(1 - atrasadas.length * 0.5) * 25;

  const taxa = s.entradas > 0 ? s.aportes / s.entradas : 0;
  const constancia = clamp(taxa / 0.15) * 25;

  const pillars: Pillar[] = [
    {
      key: 'fluxo',
      title: 'Gastou menos do que entrou',
      rule: 'Pontua cheio quando os gastos ficam abaixo de 60% do que entrou.',
      detail:
        s.entradas > 0
          ? `Gastos foram ${Math.round(ratio * 100)}% das entradas em 30 dias.`
          : 'Nenhuma entrada nos últimos 30 dias.',
      points: fluxo,
      max: 25,
    },
    {
      key: 'reserva',
      title: 'Reserva de emergência',
      rule: 'Pontua cheio com seis meses de gastos guardados.',
      detail: `A reserva cobre ${meses.toFixed(1).replace('.', ',')} ${meses >= 0.95 && meses < 1.05 ? 'mês' : 'meses'} de gastos.`,
      points: reserva,
      max: 25,
    },
    {
      key: 'emdia',
      title: 'Contas em dia',
      rule: 'Cada conta vencida e não paga tira metade do pilar.',
      detail:
        atrasadas.length === 0
          ? 'Nenhuma conta atrasada.'
          : `${atrasadas.length} ${atrasadas.length === 1 ? 'conta atrasada' : 'contas atrasadas'}.`,
      points: emdia,
      max: 25,
    },
    {
      key: 'constancia',
      title: 'Investiu este mês',
      rule: 'Pontua cheio investindo 15% do que entrou.',
      detail:
        s.entradas > 0
          ? `Investiu ${Math.round(taxa * 1000) / 10}% das entradas.`.replace('.', ',')
          : 'Nada investido ainda.',
      points: constancia,
      max: 25,
    },
  ];

  const raw = fluxo + reserva + emdia + constancia;
  const score = Math.round(raw);
  const mood = moodOf(score);
  const next = MOODS.find((m) => m.from > score);

  return { score, raw, mood, next, pillars, summary: s, meses, atrasadas, habit: nextHabit() };

  /** O hábito mais barato, em reais, que leva o Baiu ao próximo estado. */
  function nextHabit(): { text: string; pillar: PillarKey | null } {
    if (atrasadas.length > 0) {
      const b = atrasadas[0];
      return { text: `Pague ${b.title.toLowerCase()} e o Baiu recupera fôlego.`, pillar: 'emdia' };
    }
    if (!next) {
      if (raw >= 99.5) return { text: 'O Baiu está no máximo. Mantenha o ritmo deste mês.', pillar: null };
      // já estufado: completar o pilar mais barato de fechar
      const fills: { cost: number; text: string; pillar: PillarKey }[] = [];
      if (constancia < 24.5 && s.entradas > 0) {
        const cost = ((25 - constancia) / 25) * 0.15 * s.entradas;
        fills.push({ cost, text: `Invista mais ${brl(Math.ceil(cost), { cents: false })} este mês e feche o pilar de constância.`, pillar: 'constancia' });
      }
      if (fluxo < 24.5 && s.entradas > 0) {
        const cost = ((25 - fluxo) / 25) * 0.3 * s.entradas;
        fills.push({ cost, text: `Gaste ${brl(Math.ceil(cost), { cents: false })} a menos até o fim do mês e feche o pilar de gastos.`, pillar: 'fluxo' });
      }
      if (reserva < 24.5) {
        const cost = ((25 - reserva) / 25) * 6 * gastoMensal;
        fills.push({ cost, text: `Guarde mais ${brl(Math.ceil(cost), { cents: false })} e a reserva cobre seis meses de gastos.`, pillar: 'reserva' });
      }
      fills.sort((a, b) => a.cost - b.cost);
      if (fills[0]) return { text: fills[0].text, pillar: fills[0].pillar };
      return { text: 'O Baiu está estufado. Mantenha o ritmo deste mês.', pillar: null };
    }

    const need = next.from - raw;
    const label = next.label.toLowerCase();
    const options: { cost: number; text: string; pillar: PillarKey }[] = [];

    if (constancia < 25 && s.entradas > 0) {
      const room = 25 - constancia;
      if (room >= need) {
        const cost = (need / 25) * 0.15 * s.entradas;
        options.push({
          cost,
          text: `Invista mais ${brl(Math.ceil(cost), { cents: false })} este mês e o Baiu fica ${label}.`,
          pillar: 'constancia',
        });
      }
    }
    if (fluxo < 25 && s.entradas > 0) {
      const room = 25 - fluxo;
      if (room >= need) {
        const cost = (need / 25) * 0.3 * s.entradas;
        options.push({
          cost,
          text: `Gaste ${brl(Math.ceil(cost), { cents: false })} a menos até o fim do mês e o Baiu fica ${label}.`,
          pillar: 'fluxo',
        });
      }
    }
    if (reserva < 25) {
      const room = 25 - reserva;
      if (room >= need) {
        const cost = (need / 25) * 6 * gastoMensal;
        options.push({
          cost,
          text: `Guarde mais ${brl(Math.ceil(cost), { cents: false })} na reserva e o Baiu fica ${label}.`,
          pillar: 'reserva',
        });
      }
    }
    options.sort((a, b) => a.cost - b.cost);
    if (options[0]) return { text: options[0].text, pillar: options[0].pillar };
    return { text: 'Cuide de um pilar por vez: comece pela reserva.', pillar: 'reserva' };
  }
}

export type Folego = ReturnType<typeof computeFolego>;
