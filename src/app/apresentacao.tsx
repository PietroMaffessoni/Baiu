import { router } from 'expo-router';
import { useState } from 'react';

import { Comecar } from '@/components/comecar';
import { Welcome } from '@/components/welcome';

/** O primeiro uso de novo, das boas-vindas ao fim, aberto pelos Ajustes. Não guarda nada. */
export default function ReverApresentacao() {
  const [started, setStarted] = useState(false);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return started ? (
    <Comecar mode="rever" onClose={close} onBack={() => setStarted(false)} />
  ) : (
    <Welcome onStart={() => setStarted(true)} onClose={close} />
  );
}
