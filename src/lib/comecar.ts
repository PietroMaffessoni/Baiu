import AsyncStorage from '@react-native-async-storage/async-storage';

import { JUROS_FAMILIAS, REF } from '@/content/comecar';

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
    salarios: Math.floor(total / REF.salarioMinimo.value),
    cestas: Math.floor(total / REF.cestaBasica.value),
    anosAssinaturas: Math.floor(total / REF.assinaturasAno.value),
    poupanca: savingsValue(monthly, years * 12),
  };
}

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
