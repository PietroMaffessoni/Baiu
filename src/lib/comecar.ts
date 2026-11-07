import AsyncStorage from '@react-native-async-storage/async-storage';

import { CENSO, COISAS, JUROS_FAMILIAS, REF, type Para } from '@/content/comecar';

/**
 * Contas do "Começar" com as respostas da pessoa. São simulações: nada aqui
 * sai do aparelho, e as telas dizem de onde vem cada número.
 */

/** Anos até a expectativa de vida; quem já passou dela vê pelo menos 5. */
export function yearsLeft(age: number) {
  return Math.max(5, Math.round(REF.expectativaVida.value - age));
}

/** Quanto R$ `monthly` por mês viram em `months` meses na poupança. */
export function savingsValue(monthly: number, months: number, rate = REF.poupancaMes.value) {
  return (monthly * (Math.pow(1 + rate, months) - 1)) / rate;
}

export function projection(monthly: number, age: number) {
  const years = yearsLeft(age);
  const total = monthly * 12 * years;
  return {
    years,
    /** Até que idade a conta vai. */
    untilAge: age + years,
    total,
    /** Quantas de cada coisa o total compra; as que não chegam a uma ficam de fora. */
    coisas: COISAS.map((c) => ({ ...c, n: Math.floor(total / c.price) })).filter((c) => c.n > 0),
    poupanca: savingsValue(monthly, years * 12),
  };
}

/**
 * Quanto escapa por mês, em média, só em juros: o total do semestre dividido
 * pelos adultos (só para mim) ou pelas casas (minha casa).
 */
const JUROS_POR_MES = JUROS_FAMILIAS.value / JUROS_FAMILIAS.months;
export const ESCAPE_MEDIO: Record<Para, number> = {
  eu: Math.round(JUROS_POR_MES / CENSO.adultos),
  casa: Math.round(JUROS_POR_MES / CENSO.casas),
};

/** Juros pagos pelas famílias brasileiras por segundo, para o contador. */
export const JUROS_POR_SEGUNDO = JUROS_FAMILIAS.value / (JUROS_FAMILIAS.days * 24 * 3600);

/** Como a pessoa conheceu o Baiu: guardado até o cadastro, que leva junto. */
const ORIGIN_KEY = 'baiu:origem';

export async function saveOrigin(origin: string) {
  try {
    await AsyncStorage.setItem(ORIGIN_KEY, origin);
  } catch {}
}

export async function readOrigin() {
  try {
    return (await AsyncStorage.getItem(ORIGIN_KEY)) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function clearOrigin() {
  try {
    await AsyncStorage.removeItem(ORIGIN_KEY);
  } catch {}
}
