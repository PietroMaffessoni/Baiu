import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { color } from '@/theme/tokens';

/**
 * Volta do banco depois de autorizar no Open Finance (baiu://open-finance,
 * aberto pela página docs/open-finance). A tela de conexão continua aberta
 * por baixo e confere sozinha a autorização; esta tela só sai do caminho.
 */
export default function OpenFinanceVolta() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return <View style={{ flex: 1, backgroundColor: color.night }} />;
}
