import { JUROS_POR_SEGUNDO, projection, savingsValue, yearsLeft } from '../comecar';

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
    expect(p.salarios).toBe(Math.floor(84600 / 1621));
    expect(p.cestas).toBe(Math.floor(84600 / 915.01));
    expect(p.anosAssinaturas).toBe(Math.floor(84600 / 1416));
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
