import type { State } from '@/data/types';
import type { Folego } from './folego';
import { MESES_CURTOS } from './dates';

export type SealDef = {
  id: string;
  lines: [string, string?];
  title: string;
  how: string;
  earned: boolean;
  date?: string;
};

function monthTag(offset: number, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${MESES_CURTOS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

/** Selos: hábitos que o Baiu carimba. Os primeiros vêm do histórico de demonstração. */
export function sealsFor(state: State, folego: Folego, now = new Date()): SealDef[] {
  const meses = folego.meses;
  const streak = (() => {
    let n = 0;
    for (let i = state.contributions.length - 1; i >= 0 && state.contributions[i] > 0; i--) n++;
    return n;
  })();

  return [
    {
      id: 'primeira-conta',
      lines: ['1ª', 'conta'],
      title: 'Primeira conta',
      how: 'Cadastrou a primeira conta no Baiu.',
      earned: state.accounts.length > 0,
      date: monthTag(-6, now),
    },
    {
      id: 'mes-azul',
      lines: ['Mês no', 'azul'],
      title: 'Mês no azul',
      how: 'Fechou o mês gastando menos do que entrou.',
      earned: true,
      date: monthTag(-1, now),
    },
    {
      id: 'em-dia',
      lines: ['Em', 'dia'],
      title: 'Tudo em dia',
      how: 'Trinta dias sem nenhuma conta atrasada.',
      earned: folego.atrasadas.length === 0,
      date: monthTag(0, now),
    },
    {
      id: 'reserva-1',
      lines: ['Reserva', '1 mês'],
      title: 'Reserva de 1 mês',
      how: 'Guardou o equivalente a um mês de gastos.',
      earned: meses >= 1,
      date: monthTag(-3, now),
    },
    {
      id: 'constancia-3',
      lines: ['Aporte', '3 meses'],
      title: 'Três meses investindo',
      how: 'Investiu algum valor por três meses seguidos.',
      earned: streak >= 3,
      date: monthTag(0, now),
    },
    {
      id: 'reserva-3',
      lines: ['Reserva', '3 meses'],
      title: 'Reserva de 3 meses',
      how: 'Guarde o equivalente a três meses de gastos.',
      earned: meses >= 3,
      date: meses >= 3 ? monthTag(0, now) : undefined,
    },
    {
      id: 'estufado',
      lines: ['Baiu', 'estufado'],
      title: 'Baiu estufado',
      how: 'Chegue a 75 de fôlego.',
      earned: folego.score >= 75,
      date: folego.score >= 75 ? monthTag(0, now) : undefined,
    },
    {
      id: 'reserva-6',
      lines: ['Reserva', '6 meses'],
      title: 'Reserva completa',
      how: 'Seis meses de gastos guardados.',
      earned: meses >= 6,
      date: meses >= 6 ? monthTag(0, now) : undefined,
    },
    {
      id: 'constancia-12',
      lines: ['Aporte', '12 meses'],
      title: 'Um ano investindo',
      how: 'Doze meses seguidos com aporte.',
      earned: streak >= 12,
    },
  ];
}
