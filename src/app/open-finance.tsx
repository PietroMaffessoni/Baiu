import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { color } from '@/theme/tokens';

/**
 * Volta do app do banco depois de autorizar no Open Finance
 * (baiu://open-finance). O widget de conexão continua aberto por baixo e
 * percebe sozinho que a autorização terminou; esta tela só sai do caminho.
 */
export default function OpenFinanceVolta() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return <View style={{ flex: 1, backgroundColor: color.night }} />;
}
