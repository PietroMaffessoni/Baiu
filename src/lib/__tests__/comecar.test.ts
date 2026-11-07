import { ESCAPE_MEDIO, JUROS_POR_SEGUNDO, projection, savingsValue, yearsLeft } from '../comecar';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

describe('contas do Começar', () => {
  it('vai até a expectativa de vida, com pelo menos 5 anos', () => {
    expect(yearsLeft(30)).toBe(47);
    expect(yearsLeft(74)).toBe(5);
    expect(yearsLeft(80)).toBe(5);
  });

  it('soma o que escapa e converte em coisas', () => {
    const p = projection(150, 30);
    expect(p.years).toBe(47);
    expect(p.untilAge).toBe(77);
    expect(p.total).toBe(150 * 12 * 47);
    expect(p.coisas.map((c) => [c.key, c.n])).toEqual([
      ['iphone', 7],
      ['carro', 1],
      ['notas', 131],
    ]);
  });

  it('o que não chega a uma unidade fica de fora', () => {
    expect(projection(10, 70).coisas.map((c) => c.key)).toEqual(['notas']);
  });

  it('a média que escapa só em juros, por adulto e por casa', () => {
    expect(ESCAPE_MEDIO).toEqual({ eu: 557, casa: 1186 });
  });

  it('a poupança rende juros compostos sobre os depósitos', () => {
    expect(savingsValue(100, 1)).toBeCloseTo(100);
    expect(savingsValue(100, 12)).toBeCloseTo(1233.56, 1);
    expect(projection(150, 30).poupanca).toBeGreaterThan(projection(150, 30).total);
  });

  it('o contador de juros corre na casa das dezenas de milhares por segundo', () => {
    expect(Math.round(JUROS_POR_SEGUNDO)).toBe(32957);
  });
});
