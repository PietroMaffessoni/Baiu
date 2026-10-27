import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { ChatMsg } from '@/data/types';
import { getSupabaseClient } from '../auth/supabase';
import type { AssistantContext } from './context';

/**
 * Conversa com IA ligada no app? Desligada desde 27/10/2026 para não ter o
 * custo da Anthropic no lançamento: o Baiu responde só com as respostas
 * prontas, calculadas no aparelho, e não pede o aceite da IA. Para voltar,
 * troque para true e devolva aos textos legais as partes da IA (estão no
 * histórico do git, no commit que desligou).
 */
export const AI_ENABLED = false;

/** Versão do texto de consentimento da conversa com IA. Mudou o texto, muda a versão. */
export const AI_CONSENT_VERSION = '2026-10-15';

/** Nome da função no Supabase (supabase/functions/baiu-chat). */
const FUNCTION = 'baiu-chat';

export type AskMessage = { role: 'user' | 'assistant'; content: string };
export type AskInput = { messages: AskMessage[]; context: AssistantContext | null };
export type AskResult = { text: string; remaining?: number };

export type AssistantErrorCode =
  | 'not_configured'
  | 'network'
  | 'consent'
  | 'quota'
  | 'session'
  | 'busy'
  | 'subscription'
  | 'unknown';

export class AssistantFailure extends Error {
  constructor(public code: AssistantErrorCode) {
    super(code);
    this.name = 'AssistantFailure';
  }
}

export interface AssistantBackend {
  /** Falso quando o servidor de contas não está configurado neste build. */
  readonly available: boolean;
  ask(input: AskInput): Promise<AskResult>;
  /** Registra (ou revoga) no servidor o consentimento para a conversa com IA. */
  consent(granted: boolean): Promise<void>;
}

export const MAX_QUESTION = 1000;
const MAX_HISTORY = 12;
const MAX_CONTENT = 1500;

/**
 * Histórico no formato da API: só falas de texto, papéis alternados,
 * começando e terminando com a pessoa.
 */
export function toApiMessages(chat: ChatMsg[]): AskMessage[] {
  const out: AskMessage[] = [];
  for (const m of chat.slice(-MAX_HISTORY)) {
    const role = m.role === 'user' ? 'user' : 'assistant';
    const content = m.text.trim().slice(0, MAX_CONTENT);
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content = `${last.content}\n\n${content}`.slice(-MAX_CONTENT * 2);
    else out.push({ role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  while (out.length && out[out.length - 1].role !== 'user') out.pop();
  return out;
}

const STATUS: Record<number, AssistantErrorCode> = {
  401: 'session',
  402: 'subscription',
  403: 'consent',
  404: 'not_configured',
  429: 'quota',
  503: 'not_configured',
};

async function failureFrom(e: unknown): Promise<AssistantFailure> {
  if (e instanceof AssistantFailure) return e;
  if (e instanceof FunctionsFetchError) return new AssistantFailure('network');
  if (e instanceof FunctionsRelayError) return new AssistantFailure('busy');
  if (e instanceof FunctionsHttpError) {
    const res = e.context as Response | undefined;
    let code: string | undefined;
    try {
      code = ((await res?.clone().json()) as { error?: string } | undefined)?.error;
    } catch {}
    if (code === 'busy') return new AssistantFailure('busy');
    if (
      code === 'quota' ||
      code === 'consent' ||
      code === 'session' ||
      code === 'not_configured' ||
      code === 'subscription'
    ) {
      return new AssistantFailure(code);
    }
    return new AssistantFailure(STATUS[res?.status ?? 0] ?? 'unknown');
  }
  if (e instanceof TypeError && /network|fetch/i.test(e.message)) return new AssistantFailure('network');
  return new AssistantFailure('unknown');
}

export function createSupabaseAssistant(): AssistantBackend {
  return {
    get available() {
      return getSupabaseClient() !== null;
    },

    async ask(input) {
      const client = getSupabaseClient();
      if (!client) throw new AssistantFailure('not_configured');
      try {
        const { data, error } = await client.functions.invoke<{ text?: string; remaining?: number }>(FUNCTION, {
          body: { ...input, consentVersion: AI_CONSENT_VERSION },
        });
        if (error) throw error;
        const text = typeof data?.text === 'string' ? data.text.trim() : '';
        if (!text) throw new AssistantFailure('unknown');
        return { text, remaining: data?.remaining };
      } catch (e) {
        throw await failureFrom(e);
      }
    },

    async consent(granted) {
      const client = getSupabaseClient();
      if (!client) throw new AssistantFailure('not_configured');
      let res;
      try {
        res = await client.rpc('assistant_consent', { granted, version: AI_CONSENT_VERSION });
      } catch {
        throw new AssistantFailure('network');
      }
      if (res.error) {
        const offline = /fetch|network/i.test(res.error.message ?? '');
        throw new AssistantFailure(offline ? 'network' : 'unknown');
      }
    },
  };
}

type FakeDb = { consented: boolean; count: number };
const FAKE_KEY = 'baiu:fake-ai';

/**
 * IA de mentira para testes automatizados e para a web de desenvolvimento
 * (EXPO_PUBLIC_AUTH_FAKE=1). Responde sempre igual e imita consentimento e limite diário.
 */
export function createFakeAssistant(
  opts: { latencyMs?: number; offline?: () => boolean; limit?: number } = {},
): AssistantBackend & { _db: () => FakeDb } {
  let memory: FakeDb = { consented: false, count: 0 };
  const browser = typeof localStorage !== 'undefined';
  const load = (): FakeDb => {
    if (!browser) return memory;
    try {
      return { consented: false, count: 0, ...JSON.parse(localStorage.getItem(FAKE_KEY) ?? '{}') };
    } catch {
      return { consented: false, count: 0 };
    }
  };
  const save = (d: FakeDb) => (browser ? localStorage.setItem(FAKE_KEY, JSON.stringify(d)) : void (memory = d));
  const wait = async () => {
    if (opts.offline?.()) throw new AssistantFailure('network');
    if (opts.latencyMs) await new Promise((r) => setTimeout(r, opts.latencyMs));
  };
  const limit = opts.limit ?? 30;

  return {
    available: true,
    _db: load,
    async ask({ messages, context }) {
      await wait();
      const d = load();
      if (!d.consented) throw new AssistantFailure('consent');
      if (d.count >= limit) throw new AssistantFailure('quota');
      save({ ...d, count: d.count + 1 });
      const question = messages[messages.length - 1]?.content ?? '';
      const numbers = context
        ? `Recebi o resumo: este mês saíram R$ ${context.mes_atual.gastos.toFixed(2).replace('.', ',')}.`
        : 'Recebi só a pergunta, sem os seus números.';
      return { text: `Resposta da IA de teste para "${question}". ${numbers}`, remaining: limit - d.count - 1 };
    },
    async consent(granted) {
      await wait();
      save({ ...load(), consented: granted });
    },
  };
}

const useFake = process.env.EXPO_PUBLIC_AUTH_FAKE === '1' && (__DEV__ || Platform.OS === 'web');

export const assistantBackend: AssistantBackend = useFake
  ? createFakeAssistant({ latencyMs: 400 })
  : createSupabaseAssistant();
