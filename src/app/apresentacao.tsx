import { router } from 'expo-router';

import { Apresentacao } from '@/components/apresentacao';

/** A apresentação do primeiro uso, de novo, aberta pelos Ajustes. */
export default function ReverApresentacao() {
  return <Apresentacao onDone={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
