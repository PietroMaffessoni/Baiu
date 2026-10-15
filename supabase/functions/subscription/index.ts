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

export async function handle(req: Request, env: Env, http: typeof fetch = fetch): Promise<Response> {
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
