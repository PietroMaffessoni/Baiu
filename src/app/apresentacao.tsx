import { router } from 'expo-router';

import { Comecar } from '@/components/comecar';

/** O caminho do primeiro uso, de novo, aberto pelos Ajustes. Não guarda nada. */
export default function ReverApresentacao() {
  return <Comecar mode="rever" onClose={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
