// Baiu: assinatura. Função do Supabase (Deno).
//
// Quem cobra é a App Store ou o Google Play; o RevenueCat confere os recibos
// e sabe quem tem a assinatura ativa, conhecendo a pessoa só pelo id da conta.
// Esta função apaga esse cadastro no RevenueCat quando a pessoa exclui a conta
// (LGPD: a eliminação chega aos operadores). A conferência da assinatura fica
// nas funções que custam dinheiro (bank e baiu-chat).
//
// Segredos (Edge Functions, Secrets):
//   REVENUECAT_SECRET_KEY   obrigatório (chave secreta da API v1 do RevenueCat)
//   BAIU_ALERTA_URL         opcional: webhook do aviso de resposta acima de 1 s (BAIU_ALERTA_MS muda o limite)
// SUPABASE_URL e SUPABASE_ANON_KEY já existem em toda função do Supabase.
//
// Sem dependências externas: roda no Deno do Supabase e nos testes em Node
// (scripts/test-subscription.mjs).

type Env = (name: string) => string | undefined;

const REVENUECAT = 'https://api.revenuecat.com/v1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (status: number, error: string) => json(status, { error });

/** Deixa uma tarefa terminar depois da resposta (no Supabase; nos testes, só segue). */
function background(p: Promise<unknown>) {
  p.catch(() => {});
  (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(p);
}

// ---------- alerta de lentidão (igual em bank, subscription e baiu-chat) ----------

/** Resposta mais demorada que isto vira alerta. BAIU_ALERTA_MS muda o limite. */
const SLOW_MS = 1_000;
/** Um aviso por ação a cada 5 minutos; as outras lentas entram na conta do próximo aviso. */
const ALERT_EVERY = 5 * 60_000;
type Stage = { n: number; ms: number; max: number };
const lastAlert = new Map<string, { at: number; skipped: number }>();
export function _resetAlerts() {
  lastAlert.clear();
}

/** De quem é cada chamada: é isso que diz onde a demora está. */
function stageOf(url: string) {
  if (url.includes('/auth/v1/')) return 'login';
  if (url.includes('/rest/v1/')) return 'banco de dados';
  if (url.includes('polp.com.br')) return 'Polp';
  if (url.includes('revenuecat.com')) return 'assinatura (RevenueCat)';
  if (url.includes('anthropic.com') || url.includes('/v1/messages')) return 'IA';
  return 'outro';
}

/** Um fetch que anota quantas chamadas cada serviço recebeu e quanto cada uma levou. */
function timed(http: typeof fetch) {
  const stages: Record<string, Stage> = {};
  const wrapped = (async (input: Request | URL | string, init?: RequestInit) => {
    const name = stageOf(input instanceof Request ? input.url : String(input));
    const t = Date.now();
    try {
      return await http(input, init);
    } finally {
      const s = (stages[name] ??= { n: 0, ms: 0, max: 0 });
      const d = Date.now() - t;
      s.n++;
      s.ms += d;
      s.max = Math.max(s.max, d);
    }
  }) as typeof fetch;
  return { http: wrapped, stages };
}

/** Cabeçalho Server-Timing: o app e o navegador mostram onde foi o tempo de cada resposta. */
function serverTiming(total: number, stages: Record<string, Stage>) {
  const parts = Object.entries(stages).map(
    ([name, s], i) => `s${i};dur=${s.ms};desc="${name}: ${s.n}x, a mais lenta ${s.max} ms"`,
  );
  return [...parts, `total;dur=${total}`].join(', ');
}

/**
 * Passou do limite: uma linha nos logs (procure por "lento" em Edge Functions,
 * Logs) e, com BAIU_ALERTA_URL, um aviso no webhook (Slack, Discord ou outro
 * que aceite JSON com "text" ou "content"). Sem dados da pessoa: só a ação, o
 * tempo, o status e quanto cada serviço demorou.
 */
function alertSlow(
  fn: string,
  action: string,
  ms: number,
  status: number,
  stages: Record<string, Stage>,
  env: Env,
  http: typeof fetch,
) {
  const limit = Number(env('BAIU_ALERTA_MS')) || SLOW_MS;
  if (ms <= limit) return;
  console.warn(
    JSON.stringify({ alerta: 'lento', funcao: fn, acao: action, ms, limite: limit, status, etapas: stages }),
  );
  const url = env('BAIU_ALERTA_URL');
  if (!url || !/^https:\/\/\S+$/.test(url)) return;
  const now = Date.now();
  const prev = lastAlert.get(`${fn}/${action}`);
  if (prev && now - prev.at < ALERT_EVERY) {
    prev.skipped++;
    return;
  }
  lastAlert.set(`${fn}/${action}`, { at: now, skipped: 0 });
  const worst = Object.entries(stages).sort((a, b) => b[1].max - a[1].max);
  const where = worst.length
    ? worst
        .map(([name, s]) => `${name} (${s.n} ${s.n === 1 ? 'chamada' : 'chamadas'}, a mais lenta ${s.max} ms)`)
        .join(', ')
    : 'nenhum serviço de fora: a demora foi na própria função';
  const text =
    `Baiu lento: ${fn}/${action} levou ${ms} ms (limite ${limit} ms), status ${status}. ` +
    `Mais demorado: ${where}.` +
    (prev?.skipped === 1 ? ' Mais 1 resposta lenta desde o último aviso.' : '') +
    (prev && prev.skipped > 1 ? ` Mais ${prev.skipped} respostas lentas desde o último aviso.` : '');
  background(
    http(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(5_000),
    }).then(
      (r) => void (r.ok || console.error(`${fn}: o aviso de lentidão não foi aceito`, r.status)),
      () => console.error(`${fn}: o aviso de lentidão não foi enviado`),
    ),
  );
}

export async function handle(req: Request, env: Env, http: typeof fetch = fetch): Promise<Response> {
  const started = Date.now();
  const t = timed(http);
  const res = await route(req, env, t.http);
  if (req.method !== 'POST') return res;
  const ms = Date.now() - started;
  res.headers.set('Server-Timing', serverTiming(ms, t.stages));
  alertSlow('subscription', 'forget', ms, res.status, t.stages, env, http);
  return res;
}

async function route(req: Request, env: Env, http: typeof fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return fail(405, 'method');

  const base = env('SUPABASE_URL');
  const anon = req.headers.get('apikey') ?? env('SUPABASE_ANON_KEY');
  const key = env('REVENUECAT_SECRET_KEY');
  if (!base || !anon || !key) return fail(503, 'not_configured');

  const auth = req.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+$/i.test(auth)) return fail(401, 'session');

  let body: { action?: unknown };
  try {
    const raw = await req.text();
    if (raw.length > 2_000) return fail(413, 'invalid');
    body = JSON.parse(raw);
  } catch {
    return fail(400, 'invalid');
  }
  if (body.action !== 'forget') return fail(400, 'invalid');

  try {
    // quem é a pessoa: o próprio serviço de login confere o token
    const who = await http(`${base}/auth/v1/user`, { method: 'GET', headers: { Authorization: auth, apikey: anon } });
    if (who.status === 401 || who.status === 403) return fail(401, 'session');
    if (!who.ok) {
      console.error('subscription: login respondeu', who.status);
      return fail(502, 'unknown');
    }
    const uid = ((await who.json()) as { id?: string }).id;
    if (!uid) return fail(401, 'session');

    const r = await http(`${REVENUECAT}/subscribers/${encodeURIComponent(uid)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    // 404: não havia cadastro; nos dois casos, nada fica para trás
    if (r.ok || r.status === 404) return json(200, { ok: true });
    console.error('subscription: RevenueCat respondeu', r.status);
    if (r.status === 401 || r.status === 403) return fail(503, 'not_configured');
    return fail(503, 'busy');
  } catch {
    console.error('subscription: falha inesperada');
    return fail(503, 'busy');
  }
}

type DenoLike = {
  serve: (h: (r: Request) => Promise<Response>) => void;
  env: { get: (k: string) => string | undefined };
};
const deno = (globalThis as { Deno?: DenoLike }).Deno;
if (deno?.serve) deno.serve((req) => handle(req, (k) => deno.env.get(k)));
