import { createEmpty } from '@/data/demo';
import { reducer } from '@/store/reducer';
import { COLORS, DEFAULT_LOOK, easter, hsl, paletteFor, SEASONS, seasonFor, seasonRanges, upcomingSeasons } from '../look';
import { migrate } from '../migrate';

const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h);
const ymd = (x: Date) => `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;

describe('datas comemorativas', () => {
  it.each([
    [2024, '2024-3-31'],
    [2025, '2025-4-20'],
    [2026, '2026-4-5'],
    [2027, '2027-3-28'],
    [2028, '2028-4-16'],
    [2030, '2030-4-21'],
  ])('Páscoa de %i', (year, expected) => {
    expect(ymd(easter(year))).toBe(expected);
  });

  it.each([
    [d(2026, 12, 1), 'natal'],
    [d(2026, 12, 25, 23), 'natal'],
    [d(2026, 12, 26), 'ano-novo'],
    [d(2027, 1, 1), 'ano-novo'],
    [d(2027, 1, 2), 'ano-novo'],
    [d(2027, 1, 3), null],
    [d(2027, 2, 6), 'carnaval'], // sábado de Carnaval de 2027
    [d(2027, 2, 10), 'carnaval'], // Quarta-feira de Cinzas
    [d(2027, 2, 11), null],
    [d(2026, 4, 5), 'pascoa'],
    [d(2026, 3, 29), 'pascoa'],
    [d(2026, 4, 6), null],
    [d(2026, 6, 12), 'namorados'],
    [d(2026, 6, 13), 'junina'],
    [d(2026, 6, 24), 'junina'],
    [d(2026, 7, 1), null],
    [d(2026, 10, 12), 'criancas'],
    [d(2026, 10, 15), null],
    [d(2026, 10, 31, 22), 'halloween'],
    [d(2026, 11, 1), null],
  ])('%s → %s', (date, expected) => {
    expect(seasonFor(date)).toBe(expected);
  });

  it('as datas de um ano não se sobrepõem', () => {
    for (const year of [2026, 2027, 2028, 2029, 2030]) {
      const r = seasonRanges(year).sort((a, b) => a.start.getTime() - b.start.getTime());
      for (let i = 1; i < r.length; i++) expect(r[i].start.getTime()).toBeGreaterThan(r[i - 1].end.getTime());
    }
  });

  it('lista as próximas datas, uma de cada, a partir de hoje', () => {
    const up = upcomingSeasons(d(2026, 10, 15));
    expect(up.map((r) => r.id)).toEqual([
      'halloween',
      'natal',
      'ano-novo',
      'carnaval',
      'pascoa',
      'namorados',
      'junina',
      'criancas',
    ]);
    expect(new Set(up.map((r) => r.id)).size).toBe(SEASONS.length);
  });

  it('durante uma data, ela aparece primeiro', () => {
    expect(upcomingSeasons(d(2026, 12, 10))[0].id).toBe('natal');
  });
});

describe('cores', () => {
  it('converte HSL para hex', () => {
    expect(hsl(0, 1, 0.5)).toBe('#FF0000');
    expect(hsl(120, 1, 0.25)).toBe('#008000');
    expect(hsl(0, 0, 1)).toBe('#FFFFFF');
  });

  it('toda cor gera uma paleta válida em todos os humores', () => {
    for (const c of COLORS) {
      for (const m of ['murcho', 'meio', 'cheio', 'estufado'] as const) {
        const p = paletteFor(c.id, m);
        for (const v of [p.core, p.mid, p.edge, p.rim, p.spot, p.belly, p.fin, p.spine, p.glowColor]) {
          expect(v).toMatch(/^#[0-9A-F]{6}$/);
        }
      }
    }
  });

  it('o Baiu murcho brilha menos e fica mais apagado que o estufado', () => {
    const murcho = paletteFor('azul', 'murcho');
    const estufado = paletteFor('azul', 'estufado');
    expect(murcho.glow).toBeLessThan(estufado.glow);
    const sat = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      return Math.max(...c) - Math.min(...c);
    };
    expect(sat(murcho.mid)).toBeLessThan(sat(estufado.mid));
  });
});

describe('escolha guardada', () => {
  it('começa com a cor padrão e enfeites ligados', () => {
    expect(createEmpty().baiu).toEqual(DEFAULT_LOOK);
  });

  it('troca a cor e liga ou desliga os enfeites', () => {
    let s = reducer(createEmpty(), { type: 'setBaiu', patch: { color: 'turquesa' } });
    expect(s.baiu).toEqual({ color: 'turquesa', seasonal: true });
    s = reducer(s, { type: 'setBaiu', patch: { seasonal: false } });
    expect(s.baiu).toEqual({ color: 'turquesa', seasonal: false });
  });

  it('recusa cor desconhecida', () => {
    const s0 = createEmpty();
    // @ts-expect-error cor fora da lista
    expect(reducer(s0, { type: 'setBaiu', patch: { color: 'dourado' } })).toBe(s0);
  });

  it('dados antigos ganham a aparência padrão; inválidos são corrigidos', () => {
    const { baiu: _omit, ...old } = createEmpty();
    expect(migrate(old)?.baiu).toEqual(DEFAULT_LOOK);
    expect(migrate({ ...old, baiu: { color: 'dourado', seasonal: 'sim' } })?.baiu).toEqual(DEFAULT_LOOK);
    expect(migrate({ ...old, baiu: { color: 'rosa', seasonal: false } })?.baiu).toEqual({ color: 'rosa', seasonal: false });
  });

  it('entrar e sair do modo exemplo mantém a cor', () => {
    let s = reducer(reducer(createEmpty(), { type: 'onboard' }), { type: 'setBaiu', patch: { color: 'lilas' } });
    s = reducer(s, { type: 'loadDemo' });
    expect(s.baiu.color).toBe('lilas');
    s = reducer(s, { type: 'exitDemo' });
    expect(s.baiu.color).toBe('lilas');
  });
});
