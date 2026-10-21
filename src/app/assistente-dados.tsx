import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContextPreview } from '@/components/chat';
import { buildContext, describeContext } from '@/lib/assistant/context';
import { useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter } from '@/theme/tokens';

/** Transparência (LGPD, art. 9º): exatamente o que acompanha cada pergunta à IA. */
export default function AssistenteDados() {
  const { state } = useStore();
  const insets = useSafeAreaInsets();
  const sections = useMemo(() => describeContext(buildContext(state)), [state]);
  const share = state.assistant.shareNumbers;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: gutter, paddingTop: 28, paddingBottom: insets.bottom + 40, gap: 14 }}>
      <T variant="title2" accessibilityRole="header">
        O que o Baiu envia para a IA
      </T>
      <T variant="callout" tone="ink2">
        Com a conversa com IA ligada, cada pergunta vai para a Anthropic junto com a conversa recente
        {share
          ? ' e o resumo abaixo, calculado agora com os seus dados.'
          : '. Você desligou o envio dos números, então o resumo abaixo não vai junto.'}
      </T>
      <T variant="callout" tone="ink2">
        Nunca vão seu nome, e-mail, celular, bancos, apelidos de contas, nomes de quem recebeu Pix nem os movimentos um
        a um.
      </T>
      <View style={{ opacity: share ? 1 : 0.5 }}>
        <ContextPreview sections={sections} hide={state.settings.hideValues} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.nightDeep },
});
