import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Baiu } from '@/components/baiu/baiu';
import { Button, IconButton } from '@/components/button';
import { Bubble, ContextPreview, Typing } from '@/components/chat';
import { Icon } from '@/components/icon';
import type { ChatMsg } from '@/data/types';
import { buildContext, describeContext } from '@/lib/assistant/context';
import { greetingText, SUGGESTIONS } from '@/lib/assistant/local';
import { MAX_QUESTION } from '@/lib/assistant/remote';
import { useAlerts, useAssistant, type AiMode } from '@/lib/assistant/use-assistant';
import { newId } from '@/lib/ledger';
import { useFolego, useStore } from '@/store/store';
import { T } from '@/theme/text';
import { color, gutter, radius } from '@/theme/tokens';

/**
 * Conversa com o Baiu. Com a IA desligada no app (AI_ENABLED), só respostas
 * prontas. Com ela ligada, respostas da IA só com consentimento; sem ele, no
 * modo exemplo ou sem internet, o Baiu responde com as respostas prontas,
 * calculadas no aparelho.
 */
export default function BaiuChat() {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useStore();
  const folego = useFolego();
  const alerts = useAlerts();
  const ai = useAssistant();
  const [text, setText] = useState('');
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const hide = state.settings.hideValues;
  const { seen, greeted, declined } = state.assistant;

  // ao abrir, o que o Baiu notou e a pessoa ainda não viu entra na conversa
  useEffect(() => {
    const fresh = alerts.filter((a) => !seen[a.id]);
    if (!greeted) dispatch({ type: 'setAssistant', patch: { greeted: true } });
    if (fresh.length === 0) return;
    const at = new Date().toISOString();
    dispatch({
      type: 'alertsSeen',
      ids: fresh.map((a) => a.id),
      toChat: fresh.map((a): ChatMsg => ({
        id: newId('m'),
        role: 'baiu',
        text: a.text,
        at,
        source: 'aviso',
        ask: a.ask,
        bill: a.bill,
      })),
    });
  }, [alerts, seen, greeted, dispatch]);

  const send = (q: string) => {
    setText('');
    ai.send(q);
  };

  const enable = async () => {
    setError(null);
    setEnabling(true);
    try {
      await ai.enableAi();
    } catch {
      setError('Não deu para ativar agora. Confira a internet e tente de novo.');
    } finally {
      setEnabling(false);
    }
  };

  const createBill = (b: NonNullable<ChatMsg['bill']>) =>
    router.push({
      pathname: '/vencimento/novo',
      params: { title: b.title, amount: String(Math.round(b.amount * 100)), category: b.category, day: String(b.day) },
    });

  const clear = () => {
    const run = () => dispatch({ type: 'chatClear' });
    if (Platform.OS === 'web') return run();
    Alert.alert('Apagar a conversa?', 'As mensagens saem deste aparelho. Isso não pode ser desfeito.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: run },
    ]);
  };

  const showConsent = ai.mode === 'desligada' && !declined;
  const canSend = text.trim().length > 0 && !ai.busy;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <IconButton icon="back" label="Voltar" onPress={() => router.back()} />
        <View style={styles.headerTitle}>
          <T variant="title3" accessibilityRole="header">
            Baiu
          </T>
          <T variant="micro" tone="ink3">
            {MODE_LABEL[ai.mode]}
          </T>
        </View>
        {ai.chat.length > 0 ? (
          <IconButton icon="trash" label="Apagar conversa" onPress={clear} />
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        <View style={styles.hero}>
          <Baiu score={folego.score} width={120} />
        </View>
        <Bubble msg={{ role: 'baiu', text: greetingText(ai.firstName, state.demo) }} score={folego.score} />

        <ModeNote
          mode={ai.mode}
          declined={declined}
          onEnable={() => dispatch({ type: 'setAssistant', patch: { declined: false } })}
        />
        {showConsent ? (
          <ConsentCard
            onAccept={enable}
            onDecline={() => dispatch({ type: 'setAssistant', patch: { declined: true } })}
            busy={enabling}
            error={error}
          />
        ) : null}

        {ai.chat.map((m, i) => (
          <Bubble
            key={m.id}
            msg={m}
            score={folego.score}
            hide={hide}
            avatar={i === 0 || ai.chat[i - 1].role !== 'baiu'}
            onAsk={send}
            onBill={createBill}
            disabled={ai.busy}
          />
        ))}
        {ai.busy ? <Typing score={folego.score} /> : null}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => send(s)}
              disabled={ai.busy}
              accessibilityRole="button"
              accessibilityLabel={s}
              style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: color.plateHi }]}>
              <T variant="callout">{s}</T>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Pergunte ao Baiu"
            placeholderTextColor={color.ink3}
            selectionColor={color.lantern}
            style={styles.input}
            multiline
            // na web o campo começaria com duas linhas
            numberOfLines={Platform.OS === 'web' ? 1 : undefined}
            maxLength={MAX_QUESTION}
            submitBehavior="submit"
            returnKeyType="send"
            onSubmitEditing={() => canSend && send(text)}
            accessibilityLabel="Mensagem para o Baiu"
          />
          <Pressable
            onPress={() => send(text)}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            accessibilityState={{ disabled: !canSend }}
            style={({ pressed }) => [styles.send, !canSend && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}>
            <Icon name="up" size={20} tint={color.night} weight="semibold" />
          </Pressable>
        </View>
        <T variant="micro" tone="ink3" align="center" style={{ marginTop: 6 }}>
          O Baiu pode errar. As dicas são educativas, não são recomendação de investimento.
        </T>
      </View>
    </KeyboardAvoidingView>
  );
}

const MODE_LABEL: Record<AiMode, string> = {
  local: 'Seu assistente financeiro',
  demo: 'Respostas prontas do modo exemplo',
  indisponivel: 'Respostas prontas',
  desligada: 'Respostas prontas',
  ligada: 'Conversa com IA',
};

function ModeNote({ mode, declined, onEnable }: { mode: AiMode; declined: boolean; onEnable: () => void }) {
  if (mode === 'local' || mode === 'ligada' || (mode === 'desligada' && !declined)) return null;
  const text =
    mode === 'demo'
      ? 'No modo exemplo o Baiu usa respostas prontas. Crie sua conta para conversar com a inteligência artificial.'
      : mode === 'indisponivel'
        ? 'A conversa com inteligência artificial ainda não está disponível. Por enquanto, o Baiu usa respostas prontas.'
        : 'Você está usando só as respostas prontas, sem inteligência artificial.';
  return (
    <View style={styles.note}>
      <Icon name="info" size={16} tint={color.ink3} />
      <View style={{ flex: 1, gap: 6 }}>
        <T variant="caption" tone="ink2">
          {text}
        </T>
        {mode === 'desligada' ? (
          <Pressable
            onPress={onEnable}
            accessibilityRole="button"
            accessibilityLabel="Conhecer a conversa com IA"
            hitSlop={8}>
            <T variant="captionStrong" tone="lantern">
              Conhecer a conversa com IA
            </T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Consentimento específico e em destaque (LGPD, arts. 8º e 33, VIII). */
function ConsentCard({
  onAccept,
  onDecline,
  busy,
  error,
}: {
  onAccept: () => void;
  onDecline: () => void;
  busy: boolean;
  error: string | null;
}) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const preview = useMemo(() => (open ? describeContext(buildContext(state)) : []), [open, state]);
  return (
    <View style={styles.consent}>
      <T variant="title3">Conversar com inteligência artificial</T>
      <T variant="callout" tone="ink2">
        Para responder qualquer pergunta, o Baiu usa a inteligência artificial da Anthropic, empresa dos Estados Unidos.
      </T>
      <View style={{ gap: 6 }}>
        {[
          'Vão só a sua pergunta, a conversa recente e um resumo dos seus números: totais do mês, gastos por categoria, contas que se repetem e saldos somados.',
          'Não vão seu nome, e-mail, celular, bancos, apelidos de contas nem os movimentos um a um.',
          'A conversa não fica guardada no nosso servidor e não é usada para treinar a IA.',
          'Você pode desligar quando quiser em Ajustes, e tirar os números das perguntas.',
        ].map((t) => (
          <View key={t} style={styles.point}>
            <View style={styles.pointDot} />
            <T variant="callout" style={{ flex: 1 }}>
              {t}
            </T>
          </View>
        ))}
      </View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={styles.disclosure}>
        <T variant="calloutStrong" tone="lantern">
          {open ? 'Esconder o resumo' : 'Ver o resumo que seria enviado agora'}
        </T>
        <Icon
          name="chevron"
          size={12}
          tint={color.lantern}
          weight="semibold"
          style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}
        />
      </Pressable>
      {open ? <ContextPreview sections={preview} hide={state.settings.hideValues} /> : null}
      {error ? (
        <T variant="caption" tone="vermilion">
          {error}
        </T>
      ) : null}
      <Button label="Ativar a conversa com IA" onPress={onAccept} loading={busy} />
      <Button label="Agora não, só respostas prontas" kind="quiet" onPress={onDecline} disabled={busy} />
      <Pressable onPress={() => router.push('/privacidade')} accessibilityRole="link" hitSlop={8}>
        <T variant="caption" tone="ink3" align="center">
          Detalhes na Política de privacidade
        </T>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.night },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter - 4,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.line,
  },
  headerTitle: { alignItems: 'center', flex: 1 },
  list: { paddingHorizontal: gutter, paddingTop: 8, paddingBottom: 16, gap: 12 },
  hero: { alignItems: 'center', marginBottom: 4 },
  note: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: radius.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  consent: {
    gap: 12,
    padding: 16,
    borderRadius: radius.plate,
    borderCurve: 'continuous',
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 182, 72, 0.35)',
  },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  pointDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.lantern, marginTop: 7 },
  disclosure: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
    backgroundColor: color.night,
    paddingTop: 8,
  },
  suggestions: { gap: 8, paddingHorizontal: gutter, paddingBottom: 8 },
  suggestion: {
    minHeight: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: gutter },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: 22,
    backgroundColor: color.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    color: color.paper,
    fontSize: 16,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.lantern,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
