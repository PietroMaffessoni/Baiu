// Baiu: conexão de contas pelo Open Finance. Função do Supabase (Deno).
//
// Faz a ponte entre o app e a Polp, que recebe os dados dos bancos pela
// Celcoin, a instituição regulada pelo Banco Central. As chaves da Polp ficam
// só aqui. Nada de saldo ou movimento é guardado: os dados passam direto para
// o aparelho, onde ficam cifrados, e nenhum conteúdo vai para os logs (só
// códigos de status). O CPF que a pessoa digita vai para a Polp e não fica
// guardado aqui.
//
// Toda autorização é criada com o id da pessoa (cliente_user_id) e, antes de
// qualquer leitura, a função confere na Polp que a autorização é dela.
//
// Segredos (Edge Functions, Secrets):
//   POLP_CLIENT_ID, POLP_CLIENT_SECRET   obrigatórios
//   POLP_SANDBOX=1                       opcional: usa o ambiente de teste da Polp (dados fictícios, sem cobrança)
//   POLP_REDIRECT_URL                    opcional: página https que devolve a pessoa ao app depois do banco
//                                        (só vale nos planos Pro e Ultra; no Starter a Polp usa a da conta)
//   REVENUECAT_SECRET_KEY                obrigatório: só quem assina conecta e atualiza bancos
//   BAIU_SUBSCRIPTION_OFF=1              opcional: libera sem conferir a assinatura.
//                                        Só para testes; apagar antes de publicar
//   BAIU_ALERTA_URL                      opcional: webhook (Slack, Discord) que recebe o aviso de
//                                        resposta acima de 1 s; sem ele, o aviso fica só nos logs
//   BAIU_ALERTA_MS                       opcional: outro limite para o aviso, em ms
// SUPABASE_URL e SUPABASE_ANON_KEY já existem em toda função do Supabase.
//
// Sem dependências externas: roda no Deno do Supabase e nos testes em Node
// (scripts/test-bank.mjs).

type Env = (name: string) => string | undefined;
type Json = Record<string, unknown>;

const POLP = 'https://api.polp.com.br/api/v2';
/** Categorias de dados pedidas aos bancos. O texto da tela de conexão descreve exatamente estas. */
const PRODUCTS = ['ACCOUNT', 'CREDIT_CARD_ACCOUNT', 'INVESTMENTS'];
const DAY = 86_400_000;
/** Depois da primeira busca, só o que entrou na Polp desde uma semana antes da última. */
const OVERLAP_DAYS = 7;
/** A Polp atualiza investimentos no máximo a cada 6 horas: não adianta pedir antes. */
const INVESTMENTS_EVERY = 6 * 3_600_000;
const MAX_PAGES = 20;
/** Bancos por pessoa na assinatura. O app usa o mesmo número (src/lib/bank/client.ts). */
const BANK_LIMIT = 3;
const VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[\w-]{1,100}$/;
/**
 * Chamadas à Polp ao mesmo tempo, por pedido. Uma atualização faz umas 14
 * chamadas por banco; em fila, uma depois da outra, passava de 3 segundos
 * (carga/rodar.mjs). Em paralelo, sem jogar todas de uma vez na Polp.
 */
const POLP_PARALLEL = 8;
/** Quanto esperar a Polp e o banco de dados antes de desistir e pedir para tentar de novo. */
const POLP_TIMEOUT = 15_000;
const DB_TIMEOUT = 10_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (status: number, error: string) => json(status, { error });

class Stop extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const REVENUECAT = 'https://api.revenuecat.com/v1';
/** Quem já foi conferido com assinatura ativa: id -> até quando a conferência vale. */
const paid = new Map<string, number>();
export function _resetSubscriptions() {
  paid.clear();
}

type RevenueCatEntitlement = { expires_date?: string | null; grace_period_expires_date?: string | null };

/**
 * A pessoa tem a assinatura ativa no RevenueCat? Na dúvida, não libera: sem a
 * chave, a função está mal configurada; com o RevenueCat fora do ar, pede para
 * tentar de novo. Quem foi conferido há pouco segue liberado pelo cache.
 */
async function subscription(uid: string, env: Env, http: typeof fetch): Promise<'ok' | 'none' | 'misconfigured' | 'busy'> {
  if (env('BAIU_SUBSCRIPTION_OFF') === '1') return 'ok';
  const key = env('REVENUECAT_SECRET_KEY');
  if (!key) {
    console.error('bank: falta REVENUECAT_SECRET_KEY');
    return 'misconfigured';
  }
  const now = Date.now();
  if ((paid.get(uid) ?? 0) > now) return 'ok';
  let r: Response;
  try {
    r = await http(`${REVENUECAT}/subscribers/${encodeURIComponent(uid)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    console.error('bank: RevenueCat sem resposta');
    return 'busy';
  }
  if (r.status === 401 || r.status === 403) {
    console.error('bank: RevenueCat recusou a chave', r.status);
    return 'misconfigured';
  }
  if (!r.ok) {
    console.error('bank: RevenueCat respondeu', r.status);
    return 'busy';
  }
  let ent: RevenueCatEntitlement | undefined;
  try {
    const data = (await r.json()) as { subscriber?: { entitlements?: Record<string, RevenueCatEntitlement> } };
    ent = data.subscriber?.entitlements?.[env('REVENUECAT_ENTITLEMENT') || 'assinatura'];
  } catch {
    console.error('bank: RevenueCat respondeu em formato inesperado');
    return 'busy';
  }
  if (!ent) return 'none';
  // sem data de fim: acesso vitalício (ex.: cortesia dada pelo painel)
  const until = ent.expires_date
    ? Math.max(Date.parse(ent.expires_date) || 0, Date.parse(ent.grace_period_expires_date ?? '') || 0)
    : Infinity;
  if (until <= now) return 'none';
  paid.set(uid, Math.min(until, now + 10 * 60_000));
  return 'ok';
}

/**
 * Lista de bancos da Polp: é pública, igual para todo mundo e muda pouco.
 * Fica guardada por uma hora. Com muita gente abrindo a tela de conectar ao
 * mesmo tempo, só um pedido vai à Polp e os outros esperam por ele (antes,
 * 100 pessoas juntas faziam 100 buscas iguais). Vencida, a lista guardada
 * ainda serve por até um dia enquanto a nova chega, e se a Polp falhar.
 */
const LIST_FRESH = 3_600_000;
const LIST_STALE = DAY;
let cached: { list: Json[]; until: number } | null = null;
let loading: Promise<Json[]> | null = null;
export function _resetCache() {
  cached = null;
  loading = null;
}

/** Deixa uma tarefa terminar depois da resposta (no Supabase; nos testes, só segue). */
function background(p: Promise<unknown>) {
  p.catch(() => {});
  (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(p);
}

/** No máximo `n` tarefas ao mesmo tempo; as outras esperam a vez, na ordem. */
function limiter(n: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active < n) active++;
    else await new Promise<void>((r) => queue.push(r));
    try {
      return await task();
    } finally {
      // a vaga passa direto para o próximo da fila
      const next = queue.shift();
      if (next) next();
      else active--;
    }
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
function alertSlow(fn: string, action: string, ms: number, status: number, stages: Record<string, Stage>, env: Env, http: typeof fetch) {
  const limit = Number(env('BAIU_ALERTA_MS')) || SLOW_MS;
  if (ms <= limit) return;
  console.warn(JSON.stringify({ alerta: 'lento', funcao: fn, acao: action, ms, limite: limit, status, etapas: stages }));
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
    ? worst.map(([name, s]) => `${name} (${s.n} ${s.n === 1 ? 'chamada' : 'chamadas'}, a mais lenta ${s.max} ms)`).join(', ')
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

/** CPF com os dígitos verificadores certos. */
export function validCpf(raw: string) {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digit = (n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * (n + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digit(9) === Number(d[9]) && digit(10) === Number(d[10]);
}

/** Compara segredos sem revelar, pelo tempo de resposta, quantos caracteres bateram. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Chave secreta do Supabase (a nova, `sb_secret_...`, ou a antiga service_role), só para a tarefa diária. */
function serviceKey(env: Env) {
  try {
    const keys = JSON.parse(env('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, unknown>;
    if (typeof keys.default === 'string' && keys.default) return keys.default;
  } catch {}
  return env('SUPABASE_SERVICE_ROLE_KEY') || null;
}

/**
 * Quando a assinatura terminou, já contado o prazo de acerto do pagamento da
 * loja. `null`: ativa, vitalícia ou sem como saber agora (na dúvida, nada é
 * cancelado). `0`: nunca assinou.
 */
async function subscriptionEnd(uid: string, env: Env, http: typeof fetch): Promise<number | null> {
  const key = env('REVENUECAT_SECRET_KEY');
  if (!key) return null;
  let r: Response;
  try {
    r = await http(`${REVENUECAT}/subscribers/${encodeURIComponent(uid)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return null;
  }
  if (r.status === 401 || r.status === 403) {
    console.error('bank: RevenueCat recusou a chave', r.status);
    throw new Stop(503, 'not_configured');
  }
  if (!r.ok) return null;
  let ent: RevenueCatEntitlement | undefined;
  try {
    const data = (await r.json()) as { subscriber?: { entitlements?: Record<string, RevenueCatEntitlement> } };
    ent = data.subscriber?.entitlements?.[env('REVENUECAT_ENTITLEMENT') || 'assinatura'];
  } catch {
    return null;
  }
  if (!ent) return 0;
  if (!ent.expires_date) return null;
  const until = Math.max(Date.parse(ent.expires_date) || 0, Date.parse(ent.grace_period_expires_date ?? '') || 0);
  return until > Date.now() ? null : until;
}

/** Dias depois do fim da assinatura até o Baiu cancelar as autorizações dos bancos. */
const LAPSE_DAYS = 7;
/** Pessoas conferidas por execução; o resto fica para o dia seguinte. */
const CLEANUP_MAX_USERS = 300;

/**
 * Cada banco conectado custa ao Baiu uma mensalidade na Polp enquanto a
 * autorização estiver ativa. Quem sai da assinatura deixa de usar, mas a
 * autorização continuaria cobrada: passados LAPSE_DAYS do fim, o Baiu a
 * cancela na Polp e marca aqui. Os dados que já estão no aparelho ficam.
 */
async function cleanup(
  env: Env,
  http: typeof fetch,
  base: string,
  polp: (path: string, init?: RequestInit) => Promise<Json | null>,
  one: (r: Json | null) => Json | null,
) {
  if (!env('REVENUECAT_SECRET_KEY')) return { checked: 0, revoked: 0 };
  const key = serviceKey(env);
  if (!key) {
    console.error('bank: limpeza sem a chave secreta do Supabase');
    throw new Stop(503, 'not_configured');
  }
  // a chave nova vai só em apikey; a antiga (um JWT) também em Authorization
  const headers: Record<string, string> = {
    apikey: key,
    'Content-Type': 'application/json',
    ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
  };
  const rpc = async (fn: string, args: Json) => {
    const r = await http(`${base}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
    if (!r.ok) {
      console.error('bank: limpeza, o banco de dados respondeu', r.status);
      throw new Stop(r.status === 404 ? 503 : 502, r.status === 404 ? 'not_configured' : 'unknown');
    }
    return r;
  };

  type Active = { user_id: string; item_id: string; created_at: string };
  const rows = (await (await rpc('bank_active_connections', {})).json()) as Active[];
  const byUser = new Map<string, Active[]>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);

  const days = Number(env('BANK_LAPSE_DAYS'));
  const lapse = (Number.isFinite(days) && days >= 0 ? days : LAPSE_DAYS) * DAY;
  let checked = 0;
  let revoked = 0;
  for (const [uid, list] of byUser) {
    if (checked >= CLEANUP_MAX_USERS) break;
    checked++;
    const ended = await subscriptionEnd(uid, env, http);
    if (ended === null) continue;
    // nunca assinou: conta a partir da conexão mais recente
    const since = ended || Math.max(...list.map((r) => Date.parse(r.created_at) || 0));
    if (Date.now() - since < lapse) continue;
    for (const r of list) {
      if (!ID_RE.test(r.item_id)) continue;
      const c = one(await polp(`/consents/${r.item_id}`, { method: 'GET' }));
      if (c && c.cliente_user_id === uid) await polp(`/consents/${r.item_id}`, { method: 'DELETE' });
      await rpc('bank_lapse', { p_user: uid, p_item: r.item_id });
      revoked++;
    }
  }
  console.log('bank: limpeza', checked, revoked);
  return { checked, revoked };
}

const ACTIONS = new Set(['institutions', 'start', 'reconnect', 'status', 'sync', 'history', 'unlink', 'unlink_all']);

export async function handle(req: Request, env: Env, http: typeof fetch = fetch): Promise<Response> {
  const started = Date.now();
  const t = timed(http);
  const meta = { action: 'outra' };
  const res = await route(req, env, t.http, meta);
  if (req.method !== 'POST') return res;
  const ms = Date.now() - started;
  res.headers.set('Server-Timing', serverTiming(ms, t.stages));
  // a tarefa diária confere centenas de pessoas: demorar ali é normal
  if (meta.action !== 'limpeza') alertSlow('bank', meta.action, ms, res.status, t.stages, env, http);
  return res;
}

async function route(req: Request, env: Env, http: typeof fetch, meta: { action: string }): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return fail(405, 'method');

  const base = env('SUPABASE_URL');
  const anon = req.headers.get('apikey') ?? env('SUPABASE_ANON_KEY');
  const clientId = env('POLP_CLIENT_ID');
  const clientSecret = env('POLP_CLIENT_SECRET');
  if (!base || !anon || !clientId || !clientSecret) return fail(503, 'not_configured');
  const sandbox = env('POLP_SANDBOX') === '1';
  const api = sandbox ? `${POLP}/sandbox` : POLP;
  const redirect = /^https:\/\/\S+$/.test(env('POLP_REDIRECT_URL') ?? '') ? env('POLP_REDIRECT_URL') : undefined;

  const slot = limiter(POLP_PARALLEL);
  const ask = (url: string, init: RequestInit) =>
    slot(async () => {
      try {
        return await http(url, {
          ...init,
          headers: {
            'x-api-client': clientId,
            'x-api-secret': clientSecret,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(init.headers ?? {}),
          },
          signal: AbortSignal.timeout(POLP_TIMEOUT),
        });
      } catch {
        console.error('bank: a Polp não respondeu a tempo');
        throw new Stop(503, 'busy');
      }
    });

  /** Chamada à Polp. 404 vira null (autorização ou recurso que não existe mais). */
  const polp = async (path: string, init: RequestInit = {}, root = api): Promise<Json | null> => {
    let r = await ask(`${root}${path}`, init);
    // muitos pedidos de uma vez: a Polp pede para esperar. Leituras tentam mais uma vez
    if (r.status === 429 && (init.method ?? 'GET') === 'GET') {
      const wait = Number(r.headers.get('Retry-After'));
      await sleep(Number.isFinite(wait) && wait > 0 ? Math.min(wait * 1000, 2_000) : 300 + Math.random() * 400);
      r = await ask(`${root}${path}`, init);
    }
    if (r.status === 404) return null;
    if (r.status === 401 || r.status === 402 || r.status === 403) {
      // 401: chaves erradas; 402: plano inativo ou fatura em atraso; 403: conta da Polp em aprovação
      console.error('bank: a Polp recusou o acesso', r.status);
      throw new Stop(503, 'not_configured');
    }
    if (r.status === 422) {
      console.error('bank: a Polp recusou o pedido', r.status);
      throw new Stop(422, 'refused');
    }
    if (r.status === 429 || r.status >= 500) {
      console.error('bank: a Polp respondeu', r.status);
      throw new Stop(503, 'busy');
    }
    if (!r.ok) {
      console.error('bank: a Polp respondeu', r.status);
      throw new Stop(502, 'unknown');
    }
    if (r.status === 204) return {};
    const out = (await r.json()) as Json;
    return out && typeof out === 'object' ? out : {};
  };
  // respostas de um item vêm em { data: {...} }; listas em { data: [...], meta: { next_cursor } }
  const one = (r: Json | null) => (r && typeof r.data === 'object' && !Array.isArray(r.data) ? (r.data as Json) : r);

  // tarefa diária (pg_cron, sem login de pessoa): cancela as autorizações de quem ficou sem assinatura
  if (req.headers.has('x-cleanup-secret')) {
    meta.action = 'limpeza';
    const expected = env('BANK_CLEANUP_SECRET') ?? '';
    if (expected.length < 16 || !same(req.headers.get('x-cleanup-secret') ?? '', expected)) return fail(401, 'session');
    try {
      return json(200, await cleanup(env, http, base, polp, one));
    } catch (e) {
      if (e instanceof Stop) return fail(e.status, e.code);
      console.error('bank: limpeza falhou');
      return fail(502, 'unknown');
    }
  }

  const auth = req.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+$/i.test(auth)) return fail(401, 'session');

  let body: Json;
  try {
    const raw = await req.text();
    if (raw.length > 20_000) return fail(413, 'invalid');
    body = JSON.parse(raw);
  } catch {
    return fail(400, 'invalid');
  }
  if (body && ACTIONS.has(String(body.action))) meta.action = String(body.action);

  const supa = async (path: string, init: RequestInit = {}) => {
    let r: Response;
    try {
      r = await http(`${base}${path}`, {
        ...init,
        headers: { Authorization: auth, apikey: anon, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(DB_TIMEOUT),
      });
    } catch {
      console.error('bank: o banco de dados não respondeu a tempo');
      throw new Stop(503, 'busy');
    }
    if (r.status === 401) throw new Stop(401, 'session');
    if (r.status === 404) {
      console.error('bank: tabela ou função ausente; aplique as migrações dos bancos');
      throw new Stop(503, 'not_configured');
    }
    if (!r.ok) {
      console.error('bank: banco de dados respondeu', r.status);
      throw new Stop(502, 'unknown');
    }
    return r;
  };

  /** Todas as páginas de uma lista, até MAX_PAGES. */
  const all = async (path: string) => {
    const out: Json[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const sep = path.includes('?') ? '&' : '?';
      const r = await polp(cursor ? `${path}${sep}cursor=${encodeURIComponent(cursor)}` : path, { method: 'GET' });
      if (!r) break;
      if (Array.isArray(r.data)) out.push(...(r.data as Json[]));
      const next = (r.meta as Json | undefined)?.next_cursor;
      cursor = typeof next === 'string' && next ? next : null;
      if (!cursor) break;
    }
    return out;
  };

  const fetchInstitutions = async () => {
    // a lista é pública e a mesma nos dois ambientes
    const r = await polp('/institutions', { method: 'GET' }, POLP);
    const list = (Array.isArray(r?.data) ? (r!.data as Json[]) : [])
      .filter((i) => typeof i.id === 'string' && typeof i.name === 'string' && i.type !== 'BUSINESS')
      .map((i) => ({ id: i.id, name: str(i.name).slice(0, 120), status: str(i.status) })) as Json[];
    if (list.length) cached = { list, until: Date.now() + LIST_FRESH };
    return list;
  };
  const institutions = async () => {
    const now = Date.now();
    if (cached && cached.until > now) return cached.list;
    // uma busca só, mesmo com muita gente pedindo junto
    const p = (loading ??= fetchInstitutions().finally(() => (loading = null)));
    if (cached && now - cached.until < LIST_STALE) {
      // vencida: entrega a guardada e atualiza por trás, sem ninguém esperar
      background(p);
      return cached.list;
    }
    return p;
  };

  try {
    // quem é a pessoa: o próprio serviço de login confere o token
    const who = await supa('/auth/v1/user', { method: 'GET' });
    const uid = ((await who.json()) as { id?: string }).id;
    if (!uid) throw new Stop(401, 'session');

    // conectar e atualizar fazem parte da assinatura; ver e cancelar autorizações fica sempre liberado
    if (['start', 'reconnect', 'status', 'sync'].includes(String(body.action))) {
      const paying = await subscription(uid, env, http);
      if (paying === 'misconfigured') throw new Stop(503, 'not_configured');
      if (paying === 'busy') throw new Stop(503, 'busy');
      if (paying === 'none') throw new Stop(402, 'subscription');
    }

    /** A autorização na Polp, só se for desta pessoa. */
    const consent = async (id: unknown) => {
      if (typeof id !== 'string' || !ID_RE.test(id)) throw new Stop(400, 'invalid');
      const c = one(await polp(`/consents/${id}`, { method: 'GET' }));
      return c && c.cliente_user_id === uid ? c : null;
    };
    const owned = async (id: unknown) => {
      const c = await consent(id);
      if (!c) throw new Stop(404, 'not_found');
      return c;
    };
    type Row = { item_id: string; institution: string; created_at: string; revoked_at: string | null; products: string[] };
    const rows = async (active: boolean): Promise<Row[]> => {
      const filter = active ? '&revoked_at=is.null' : '';
      const r = await supa(
        `/rest/v1/bank_connections?select=item_id,institution,created_at,revoked_at,products&order=created_at.desc${filter}`,
        { method: 'GET' },
      );
      return (await r.json()) as Row[];
    };
    const rpc = (fn: string, args: Json) => supa(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
    const redirectBody = redirect ? { redirectUrl: redirect } : {};

    /** O que o app precisa para mandar a pessoa ao banco (ou seguir direto, se já autorizou). */
    const started = (c: Json, name: string) => ({
      id: str(c.id),
      name,
      status: str(c.status),
      url: c.status === 'AWAITING_AUTHORIZATION' ? str(c.url_to_authenticate) || null : null,
      sandbox,
    });
    const expiresSoon = (at: unknown) => {
      const t = Date.parse(str(at));
      return Number.isNaN(t) || t - Date.now() < 5 * 60_000;
    };

    // cancela na Polp (encerra o acesso ao banco) e marca aqui
    const revoke = async (id: string) => {
      const c = await consent(id);
      if (c) await polp(`/consents/${id}`, { method: 'DELETE' });
      await rpc('bank_unlink', { item_id: id });
    };

    switch (body.action) {
      case 'institutions':
        return json(200, { institutions: await institutions() });

      case 'start': {
        if (typeof body.consentVersion !== 'string' || !VERSION_RE.test(body.consentVersion))
          throw new Stop(400, 'invalid');
        if (typeof body.institutionId !== 'string' || !ID_RE.test(body.institutionId)) throw new Stop(400, 'invalid');
        const cpf = typeof body.cpf === 'string' ? body.cpf.replace(/\D/g, '') : '';
        if (!validCpf(cpf)) throw new Stop(400, 'cpf');
        const inst = (await institutions()).find((i) => i.id === body.institutionId);
        if (!inst) throw new Stop(404, 'not_found');
        if (!sandbox && inst.status === 'MAJOR_OUTAGE') throw new Stop(409, 'bank_down');

        // no máximo BANK_LIMIT bancos por pessoa; o mesmo banco de novo não conta
        const active = await rows(true);
        if (active.length >= BANK_LIMIT && !active.some((r) => r.institution === inst.name)) {
          let count = 0;
          for (const r of active) {
            const c = await consent(r.item_id);
            const stale =
              !c ||
              c.status === 'REJECTED' ||
              (c.status === 'AWAITING_AUTHORIZATION' && expiresSoon(c.url_to_authenticate_expires_at));
            // autorização abandonada no meio ou recusada: não custa nada e só ocupa lugar
            if (stale) await revoke(r.item_id);
            else count++;
          }
          if (count >= BANK_LIMIT) throw new Stop(409, 'limit');
        }

        const payload = {
          institution_id: inst.id,
          cpf,
          cliente_user_id: uid,
          products: PRODUCTS,
          avoidDuplicates: true,
          ...redirectBody,
        };
        let c = one(await polp('/consents', { method: 'POST', body: JSON.stringify(payload) }));
        // a Polp devolve uma autorização já existente para o mesmo CPF e banco; se for de outra conta do Baiu, cria outra
        if (c && c.cliente_user_id !== uid) {
          c = one(await polp('/consents', { method: 'POST', body: JSON.stringify({ ...payload, avoidDuplicates: false }) }));
        }
        if (!c || typeof c.id !== 'string' || !ID_RE.test(c.id)) throw new Stop(502, 'unknown');
        // endereço de autorização vencido (vale uma hora) ou autorização recusada: pede uma nova
        if (
          (c.status === 'AWAITING_AUTHORIZATION' && expiresSoon(c.url_to_authenticate_expires_at)) ||
          c.status === 'REJECTED' ||
          c.status === 'EXPIRED'
        ) {
          c = one(await polp(`/consents/${c.id}/recreate`, { method: 'POST', body: JSON.stringify(redirectBody) })) ?? c;
        }
        await rpc('bank_link', { item_id: c.id, institution: inst.name, version: body.consentVersion, products: PRODUCTS });
        return json(200, started(c, str(inst.name)));
      }

      case 'reconnect': {
        if (typeof body.consentVersion !== 'string' || !VERSION_RE.test(body.consentVersion))
          throw new Stop(400, 'invalid');
        await owned(body.itemId);
        const row = (await rows(false)).find((r) => r.item_id === body.itemId);
        const c = one(await polp(`/consents/${body.itemId}/recreate`, { method: 'POST', body: JSON.stringify(redirectBody) }));
        if (!c) throw new Stop(404, 'not_found');
        await rpc('bank_link', {
          item_id: body.itemId,
          institution: row?.institution ?? '',
          version: body.consentVersion,
          products: PRODUCTS,
        });
        return json(200, started(c, row?.institution || 'Banco'));
      }

      case 'status': {
        const c = await owned(body.itemId);
        const row = (await rows(false)).find((r) => r.item_id === body.itemId);
        return json(200, { consent: str(c.status), item: toItem(c, row?.institution || 'Banco') });
      }

      case 'sync': {
        const since = body.since && typeof body.since === 'object' ? (body.since as Record<string, unknown>) : {};
        const active = await rows(true);
        const ids = new Set(active.map((r) => r.item_id));
        const out = {
          items: [] as Json[],
          accounts: [] as Json[],
          transactions: [] as Json[],
          investments: [] as Json[],
          // bancos do aparelho cuja autorização acabou (cancelada em outro aparelho ou por falta de assinatura)
          revoked: Object.keys(since).filter((id) => ID_RE.test(id) && !ids.has(id)),
        };
        type Part = { item: Json; accounts: Json[]; transactions: Json[]; investments: Json[] };
        /** Um banco: confere a autorização e então busca contas, cartões e investimentos ao mesmo tempo. */
        const fetchBank = async (row: Row): Promise<Part | null> => {
          const id = row.item_id;
          const c = await consent(id);
          // autorização cancelada no banco, ou que a pessoa nunca terminou: não aparece como banco conectado
          if (!c || c.status === 'AWAITING_AUTHORIZATION' || c.status === 'REJECTED') return null;
          const part: Part = { item: toItem(c, row.institution || 'Banco'), accounts: [], transactions: [], investments: [] };
          if (c.status !== 'AUTHORISED') return part;

          const last = typeof since[id] === 'string' ? Date.parse(since[id] as string) : NaN;
          const fresh = Number.isNaN(last);
          const from = fresh ? '' : `?fromCreatedAt=${new Date(last - OVERLAP_DAYS * DAY).toISOString()}`;

          const accounts = async () => {
            const list = (await all(`/consents/${id}/accounts`)).filter((a) => typeof a.id === 'string');
            const txs = await Promise.all(list.map((a) => all(`/accounts/${a.id}/transactions${from}`)));
            return list.map((a, k) => ({ account: toAccount(a, id) as Json, tx: txs[k].map((t) => toTx(t, str(a.id)) as Json) }));
          };
          const cards = async () => {
            const list = (await all(`/consents/${id}/credit-cards`)).filter((card) => typeof card.id === 'string');
            return Promise.all(
              list.map(async (card) => {
                const [bills, txs] = await Promise.all([
                  polp(`/credit-cards/${card.id}/bills`, { method: 'GET' }),
                  all(`/credit-cards/${card.id}/transactions${from}`),
                ]);
                return {
                  account: toCard(card, id, Array.isArray(bills?.data) ? (bills!.data as Json[]) : []) as Json,
                  tx: txs.map((t) => toCardTx(t, str(card.id))).filter((tx) => tx !== null) as Json[],
                };
              }),
            );
          };
          const investments = async () => {
            if (!fresh && Date.now() - last <= INVESTMENTS_EVERY) return [];
            const lists = await Promise.all(INVESTMENT_LISTS.map(([path]) => all(`/consents/${id}/${path}`)));
            return lists.flatMap((list, k) => list.map((i) => toInvestment(i, id, INVESTMENT_LISTS[k][1])).filter((i) => i !== null)) as Json[];
          };

          const [acc, crd, inv] = await Promise.all([accounts(), cards(), investments()]);
          for (const a of [...acc, ...crd]) {
            part.accounts.push(a.account);
            part.transactions.push(...a.tx);
          }
          part.investments.push(...inv);
          return part;
        };

        // os bancos também ao mesmo tempo; a resposta sai na ordem de antes
        for (const part of await Promise.all(active.map(fetchBank))) {
          if (!part) continue;
          out.items.push(part.item);
          out.accounts.push(...part.accounts);
          out.transactions.push(...part.transactions);
          out.investments.push(...part.investments);
        }
        return json(200, out);
      }

      case 'history': {
        // todas as autorizações, inclusive canceladas: o Open Finance exige que a pessoa as veja
        const list = (await rows(false)).slice(0, 50);
        const out = await Promise.all(
          list.map(async (r) => {
            let status = 'cancelada';
            if (!r.revoked_at) {
              const c = await consent(r.item_id);
              status = c ? consentStatus(str(c.status)) : 'cancelada';
            }
            return {
              id: r.item_id,
              name: r.institution || 'Banco',
              createdAt: r.created_at,
              revokedAt: r.revoked_at,
              products: Array.isArray(r.products) ? r.products : [],
              status,
            };
          }),
        );
        return json(200, { consents: out });
      }

      case 'unlink': {
        if (typeof body.itemId !== 'string' || !(await rows(true)).some((r) => r.item_id === body.itemId))
          throw new Stop(404, 'not_found');
        await revoke(body.itemId);
        return json(200, { ok: true });
      }

      case 'unlink_all': {
        for (const r of await rows(true)) await revoke(r.item_id);
        return json(200, { ok: true });
      }

      default:
        return fail(400, 'invalid');
    }
  } catch (e) {
    if (e instanceof Stop) return fail(e.status, e.code);
    console.error('bank: falha inesperada');
    return fail(502, 'unknown');
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
/** Valores da Polp vêm como { amount: "1500.00", currency: "BRL" }. */
const money = (v: unknown) => {
  const raw = (v as Json | null | undefined)?.amount;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
};
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Situação da autorização, em palavras do app. */
function consentStatus(s: string) {
  if (s === 'AUTHORISED') return 'autorizada';
  if (s === 'AWAITING_AUTHORIZATION') return 'pendente';
  if (s === 'REJECTED') return 'recusada';
  if (s === 'EXPIRED') return 'vencida';
  return 'cancelada';
}

function toItem(c: Json, name: string) {
  const s = str(c.status);
  const status =
    s === 'AUTHORISED'
      ? c.execution_status === 'AWAITING_RESOURCES' || !c.execution_status
        ? 'UPDATING'
        : 'UPDATED'
      : s === 'AWAITING_AUTHORIZATION'
        ? 'WAITING_USER_INPUT'
        : 'LOGIN_ERROR';
  return { id: str(c.id), name: name.slice(0, 120), status, updatedAt: str(c.updated_at) || null };
}

const last4 = (v: unknown) => {
  const d = str(v).replace(/\D/g, '');
  return d ? d.slice(-4) : null;
};

/** Só o que o app usa. Sem titular, CPF, agência ou número completo da conta. */
function toAccount(a: Json, itemId: string) {
  const type = str(a.type);
  const balance = a.balance as Json | null | undefined;
  return {
    id: str(a.id),
    itemId,
    type: 'BANK',
    subtype: type === 'CONTA_POUPANCA' ? 'SAVINGS_ACCOUNT' : 'CHECKING_ACCOUNT',
    name: type === 'CONTA_POUPANCA' ? 'Poupança' : type === 'CONTA_PAGAMENTO_PRE_PAGA' ? 'Conta de pagamento' : 'Conta',
    last4: last4(a.number),
    balance: money(balance?.available_amount) ?? 0,
    creditLimit: null,
    dueDate: null,
  };
}

/** Cartão: o que já foi usado do limite e o dia de vencimento da fatura. */
function toCard(card: Json, itemId: string, bills: Json[]) {
  const limits = Array.isArray(card.limits) ? (card.limits as Json[]) : [];
  const total = limits.find((l) => l.credit_line_limit_type === 'LIMITE_CREDITO_TOTAL') ?? limits[0];
  const methods = Array.isArray(card.payment_methods) ? (card.payment_methods as Json[]) : [];
  const due = bills
    .map((b) => str(b.due_date))
    .filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d))
    .sort()
    .pop();
  return {
    id: str(card.id),
    itemId,
    type: 'CREDIT',
    subtype: 'CREDIT_CARD',
    name: str(card.name).slice(0, 60) || 'Cartão',
    last4: last4(methods[0]?.identification_number),
    balance: money(total?.used_amount) ?? 0,
    creditLimit: money(total?.limit_amount),
    dueDate: due ?? null,
  };
}

/** Do outro lado do Pix ou TED, só se é pessoa ou empresa: nem nome, nem documento. */
function toTx(t: Json, accountId: string) {
  const person = str(t.partie_person_type);
  return {
    id: str(t.id),
    accountId,
    date: str(t.transaction_date_time),
    description: str(t.transaction_name).slice(0, 120),
    amount: Math.abs(money(t.transaction_amount) ?? 0),
    type: t.credit_debit_type === 'CREDITO' ? 'CREDIT' : 'DEBIT',
    category: str(t.category_ref) || null,
    operationType: str(t.type) || null,
    party: person === 'PESSOA_NATURAL' ? 'cpf' : person === 'PESSOA_JURIDICA' ? 'cnpj' : null,
  };
}

/**
 * Compra no cartão. Parcelas futuras e lançamentos agendados (ainda sem data
 * na fatura) ficam de fora: entram quando o banco lançar cada um.
 */
function toCardTx(t: Json, cardId: string) {
  const posted = str(t.bill_post_date);
  if (!/^\d{4}-\d{2}-\d{2}/.test(posted) || posted.startsWith('0001-')) return null;
  const n = num(t.charge_number);
  const i = num(t.charge_identificator);
  const name = str(t.transaction_name);
  const installment = n !== null && n > 1 && i !== null;
  // cada parcela entra no mês em que caiu na fatura, não no dia da compra
  const date = installment && i > 1 ? `${posted.slice(0, 10)}T12:00:00Z` : str(t.transaction_date_time) || `${posted}T12:00:00Z`;
  return {
    id: str(t.id),
    accountId: cardId,
    date,
    description: (installment && !/\d+\s*\/\s*\d+/.test(name) ? `${name} ${i}/${n}` : name).slice(0, 120),
    amount: Math.abs(money(t.brazilian_amount) ?? money(t.amount) ?? 0),
    type: t.credit_debit_type === 'CREDITO' ? 'CREDIT' : 'DEBIT',
    category: str(t.category_ref) || null,
    operationType: str(t.transaction_type) || null,
    party: null,
  };
}

type InvestmentKind = 'bank' | 'credit' | 'fund' | 'treasury' | 'stock';
const INVESTMENT_LISTS: [string, InvestmentKind][] = [
  ['bank-fixed-incomes', 'bank'],
  ['credit-fixed-incomes', 'credit'],
  ['funds', 'fund'],
  ['treasure-titles', 'treasury'],
  ['variable-incomes', 'stock'],
];

const monthYear = (d: string) => (/^\d{4}-\d{2}/.test(d) ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : '');

/** Posição de um investimento. Fica de fora o que já foi resgatado por inteiro. */
function toInvestment(i: Json, itemId: string, kind: InvestmentKind) {
  const b = (i.balance ?? null) as Json | null;
  const value = money(b?.net_amount) ?? money(b?.gross_amount);
  if (value === null || value <= 0) return null;
  const qty = num(b?.quantity);
  const due = monthYear(str(i.due_date));
  let name = '';
  let type = 'FIXED_INCOME';
  let subtype: string | null = str(i.investment_type) || null;
  let invested: number | null = null;
  if (kind === 'bank') {
    name = `${subtype ?? 'Renda fixa'}${due ? ` · vence ${due}` : ''}`;
    const unit = money(i.issue_unit_price);
    invested = qty !== null && unit !== null ? qty * unit : null;
  } else if (kind === 'credit') {
    name = `${subtype === 'DEBENTURES' ? 'Debênture' : (subtype ?? 'Crédito privado')}${str(i.debtor_name) ? ` ${str(i.debtor_name)}` : ''}`;
  } else if (kind === 'fund') {
    name = str(i.name) || 'Fundo de investimento';
    type = 'MUTUAL_FUND';
    subtype = str(i.anbima_category) || null;
  } else if (kind === 'treasury') {
    name = str(i.product_name) || `Tesouro Direto${due ? ` ${due}` : ''}`;
    type = 'TREASURY';
    subtype = 'TREASURY';
    const unit = money(b?.purchase_unit_price);
    invested = qty !== null && unit !== null ? qty * unit : null;
  } else {
    name = str(i.ticker) || 'Ação';
    type = 'EQUITY';
    subtype = 'STOCK';
  }
  return { id: str(i.id), itemId, name: name.slice(0, 60), type, subtype, balance: value, invested };
}

type DenoLike = {
  serve: (h: (r: Request) => Promise<Response>) => void;
  env: { get: (k: string) => string | undefined };
};
const deno = (globalThis as { Deno?: DenoLike }).Deno;
if (deno?.serve) deno.serve((req) => handle(req, (k) => deno.env.get(k)));
