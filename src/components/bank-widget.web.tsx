import { StyleSheet, View } from 'react-native';

import { bankBackend } from '@/lib/bank/client';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';
import type { BankWidgetProps } from './bank-widget';
import { Button } from './button';
import { FakeConnect } from './fake-connect';

/** Na web (só visualização), a conexão de verdade não existe; o banco de teste sim. */
export function BankWidget({ onSuccess, onClose }: BankWidgetProps) {
  if (bankBackend.fake) return <FakeConnect onSuccess={onSuccess} onClose={onClose} />;
  return (
    <View style={styles.screen}>
      <T variant="title3" align="center">
        A conexão com bancos funciona no aplicativo para celular.
      </T>
      <Button label="Fechar" kind="quiet" onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: gutter,
    backgroundColor: color.night,
  },
});
