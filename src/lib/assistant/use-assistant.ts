import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ChatMsg } from '@/data/types';
import { newId } from '../ledger';
import { useAuth } from '@/store/auth';
import { useStore } from '@/store/store';
import { buildContext } from './context';
import { buildAlerts } from './insights';
import { answerLocally } from './local';
import { cancelDigest, scheduleDigest } from './notify';
import {
  AI_CONSENT_VERSION,
  AI_ENABLED,
  assistantBackend,
  AssistantFailure,
  MAX_QUESTION,
  toApiMessages,
  type AssistantBackend,
  type AssistantErrorCode,
} from './remote';
import { cleanReply } from './text';

/** Avisos do mês, recalculados quando os dados mudam. */
export function useAlerts() {
  const { state } = useStore();
  return useMemo(() => buildAlerts(state), [state]);
}

const FALLBACK: Record<AssistantErrorCode, string> = {
  network: 'Estou sem internet agora, então vai uma resposta pronta.',
  quota: 'Você chegou ao limite de perguntas com IA de hoje. Amanhã tem mais. Por enquanto, uma resposta pronta.',
  busy: 'A IA está ocupada agora. Enquanto isso, uma resposta pronta.',
  not_configured: 'A conversa com IA ainda não está disponível. Vai uma resposta pronta.',
  session: 'Sua sessão terminou. Entre de novo para conversar com a IA. Por enquanto, uma resposta pronta.',
  consent: 'Preciso que você ative de novo a conversa com IA. Por enquanto, uma resposta pronta.',
  subscription: 'A conversa com IA faz parte da assinatura, que não está ativa. Por enquanto, uma resposta pronta.',
  unknown: 'Algo deu errado do meu lado. Vai uma resposta pronta.',
};

const msg = (role: ChatMsg['role'], text: string, extra: Partial<ChatMsg> = {}): ChatMsg => ({
  id: newId('m'),
  role,
  text,
  at: new Date().toISOString(),
  ...extra,
});

export type AiMode =
  /** IA desligada no app (AI_ENABLED): só respostas prontas, sem falar em IA. */
  | 'local'
  /** Dados de exemplo: só respostas prontas. */
  | 'demo'
  /** Servidor não configurado neste build. */
  | 'indisponivel'
  /** Falta o consentimento. */
  | 'desligada'
  | 'ligada';

export function useAssistant(backend: AssistantBackend = assistantBackend) {
  const { state, dispatch } = useStore();
  const { profile } = useAuth();
  const a = state.assistant;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const mode: AiMode = !AI_ENABLED
    ? 'local'
    : state.demo
      ? 'demo'
      : !backend.available
        ? 'indisponivel'
        : a.consent?.version === AI_CONSENT_VERSION && !a.pendingRevoke
          ? 'ligada'
          : 'desligada';
  const firstName = profile?.fullName.split(' ')[0] || undefined;

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim().slice(0, MAX_QUESTION);
      if (!question || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      const mine = msg('user', question);
      dispatch({ type: 'chatAdd', msgs: [mine] });
      try {
        if (mode !== 'ligada') {
          // uma pausa curta: resposta instantânea parece não ter lido a pergunta
          await new Promise((r) => setTimeout(r, 450));
          dispatch({
            type: 'chatAdd',
            msgs: [msg('baiu', answerLocally(question, state, new Date(), firstName), { source: 'pronta' })],
          });
          return;
        }
        try {
          const res = await backend.ask({
            messages: toApiMessages([...a.chat, mine]),
            context: a.shareNumbers ? buildContext(state) : null,
          });
          dispatch({ type: 'chatAdd', msgs: [msg('baiu', cleanReply(res.text), { source: 'ia' })] });
        } catch (e) {
          const code = e instanceof AssistantFailure ? e.code : 'unknown';
          // o servidor não tem o consentimento: volta a pedir
          if (code === 'consent') dispatch({ type: 'setAssistant', patch: { consent: null } });
          const local = answerLocally(question, state, new Date(), firstName);
          dispatch({ type: 'chatAdd', msgs: [msg('baiu', `${FALLBACK[code]}\n\n${local}`, { source: 'pronta' })] });
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [mode, state, a.chat, a.shareNumbers, backend, dispatch, firstName],
  );

  /** Liga a conversa com IA. O aceite é registrado no servidor antes de valer. */
  const enableAi = useCallback(async () => {
    await backend.consent(true);
    dispatch({
      type: 'setAssistant',
      patch: {
        consent: { version: AI_CONSENT_VERSION, at: new Date().toISOString() },
        declined: false,
        pendingRevoke: false,
      },
    });
  }, [backend, dispatch]);

  /** Desliga na hora, no aparelho; o registro no servidor vai quando houver internet. */
  const disableAi = useCallback(async () => {
    dispatch({ type: 'setAssistant', patch: { consent: null, pendingRevoke: true } });
    try {
      await backend.consent(false);
      dispatch({ type: 'setAssistant', patch: { pendingRevoke: false } });
    } catch {}
  }, [backend, dispatch]);

  return { mode, busy, send, enableAi, disableAi, firstName, chat: a.chat };
}

/**
 * Manutenção em segundo plano, só para contas reais: agenda o aviso por
 * notificação quando aparece algo novo e reenvia uma revogação que ficou
 * sem internet.
 */
export function useAssistantUpkeep(enabled: boolean, backend: AssistantBackend = assistantBackend) {
  const { state, dispatch } = useStore();
  const alerts = useAlerts();
  const { seen, notified, pendingRevoke } = state.assistant;
  const alertsOn = state.settings.alerts;

  useEffect(() => {
    if (!enabled) return;
    const unseen = alerts.filter((x) => !seen[x.id]);
    if (!alertsOn || unseen.length === 0) {
      cancelDigest().catch(() => {});
      return;
    }
    const fresh = unseen.filter((x) => !notified[x.id]);
    if (fresh.length === 0) return;
    const t = setTimeout(() => {
      scheduleDigest(unseen)
        .then((ok) => ok && dispatch({ type: 'alertsNotified', ids: fresh.map((x) => x.id) }))
        .catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [enabled, alerts, seen, notified, alertsOn, dispatch]);

  useEffect(() => {
    if (!enabled || !pendingRevoke || !backend.available) return;
    backend
      .consent(false)
      .then(() => dispatch({ type: 'setAssistant', patch: { pendingRevoke: false } }))
      .catch(() => {});
  }, [enabled, pendingRevoke, backend, dispatch]);
}
