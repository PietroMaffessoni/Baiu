import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bankBackend, type createFakeBank } from '@/lib/bank/client';
import { FAKE_BANKS } from '@/lib/bank/fake-data';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';
import { Button } from './button';
import { Icon } from './icon';

/**
 * Widget de teste, no lugar do da Pluggy, quando o app roda com o servidor
 * falso (testes automáticos e web de desenvolvimento). Imita os passos de
 * escolher o banco e autorizar.
 */
export function FakeConnect({ onSuccess, onClose }: { onSuccess: (itemId: string) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [bank, setBank] = useState<(typeof FAKE_BANKS)[number] | null>(null);
  const fake = bankBackend as ReturnType<typeof createFakeBank>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: gutter, paddingTop: insets.top + 16, gap: 14 }}>
      <View style={styles.badge}>
        <T variant="micro" tone="ink3">
          AMBIENTE DE TESTE · NENHUM BANCO REAL
        </T>
      </View>
      {!bank ? (
        <>
          <T variant="title2">Escolha seu banco</T>
          {FAKE_BANKS.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => setBank(b)}
              accessibilityRole="button"
              accessibilityLabel={b.name}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: color.plateHi }]}>
              <Icon name="bank" size={20} tint={color.ink2} />
              <T variant="body" style={{ flex: 1 }}>
                {b.name}
              </T>
              <Icon name="chevron" size={13} tint={color.ink3} />
            </Pressable>
          ))}
          <Button label="Fechar" kind="quiet" onPress={onClose} />
        </>
      ) : (
        <>
          <T variant="title2">{bank.name}</T>
          <T variant="callout" tone="ink2">
            Aqui seria o app do seu banco pedindo a autorização do Open Finance: contas, cartões, movimentos e
            investimentos, só para leitura.
          </T>
          <Button label="Autorizar" onPress={() => onSuccess(fake._create(bank.id))} />
          <Button label="Voltar" kind="quiet" onPress={() => setBank(null)} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.nightDeep },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.lineStrong,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: radius.plate,
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
});
