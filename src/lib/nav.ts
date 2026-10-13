import { router } from 'expo-router';

/** Fecha um modal ou folha. Sem tela anterior (link direto), volta para o início. */
export function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
