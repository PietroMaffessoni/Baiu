import AsyncStorage from '@react-native-async-storage/async-storage';

/** A apresentação aparece uma vez por aparelho, antes das boas-vindas. */
const KEY = 'baiu:apresentacao-vista';

export async function introSeen() {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    // sem como ler: melhor não prender a pessoa na apresentação
    return true;
  }
}

export async function markIntroSeen() {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {}
}
