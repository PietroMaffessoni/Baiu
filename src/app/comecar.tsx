import { router } from 'expo-router';

import { Comecar } from '@/components/comecar';

/** Do "Começar" das boas-vindas até o cadastro. */
export default function ComecarScreen() {
  return <Comecar mode="novo" onClose={() => (router.canGoBack() ? router.back() : router.replace('/boas-vindas'))} />;
}
