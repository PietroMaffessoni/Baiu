import AsyncStorage from '@react-native-async-storage/async-storage';

/** A apresentação aparece uma vez por aparelho, antes das boas-vindas. */
const KEY = 'baiu:apresentacao-vista';
/**
 * Versão do conteúdo. Ao trocar os dados da apresentação, troque aqui também:
 * quem viu a versão anterior vê a nova uma vez.
 */
export const INTRO_VERSION = '2026-10-28';

export async function introSeen() {
  try {
    return (await AsyncStorage.getItem(KEY)) === INTRO_VERSION;
  } catch {
    // sem como ler: melhor não prender a pessoa na apresentação
    return true;
  }
}

export async function markIntroSeen() {
  try {
    await AsyncStorage.setItem(KEY, INTRO_VERSION);
  } catch {}
}
