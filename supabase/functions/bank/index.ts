// Baiu: conexão de contas pelo Open Finance. Função do Supabase (Deno).
//
// Faz a ponte entre o app e o provedor (Pluggy), que é quem conversa com os
// bancos. As chaves do provedor ficam só aqui. Nada de saldo ou movimento é
// guardado: os dados passam direto para o aparelho, onde ficam cifrados, e
// nenhum conteúdo vai para os logs (só códigos de status).
//
// Toda conexão é criada com o id da pessoa (clientUserId) e, antes de
// qualquer leitura, a função confere no provedor que a conexão é dela.
//
// Segredos (Edge Functions, Secrets):
//   PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET   obrigatórios
//   PLUGGY_SANDBOX=1                         opcional: mostra os bancos de teste no widget
//   REVENUECAT_SECRET_KEY                    com ela, só quem assina conecta e atualiza bancos
// SUPABASE_URL e SUPABASE_ANON_KEY já existem em toda função do Supabase.
//
// Sem dependências externas: roda no Deno do Supabase e nos testes em Node
// (scripts/test-bank.mjs).

type Env = (name: string) => string | undefined;
type Json = Record<string, unknown>;

const PLUGGY = 'https://api.pluggy.ai';
const DAY = 86_400_000;
/** Na primeira busca, um ano de histórico; depois, uma semana antes da última busca. */
const FIRST_DAYS = 365;
const OVERLAP_DAYS = 7;
const MAX_PAGES = 20;
const VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;

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
 * A pessoa tem a assinatura ativa no RevenueCat? Sem REVENUECAT_SECRET_KEY, não
 * há cobrança e tudo fica liberado. Com o RevenueCat fora do ar, libera (quem
 * paga não fica sem o serviço); com a chave recusada, bloqueia e avisa no log.
 */
async function subscription(uid: string, env: Env, http: typeof fetch): Promise<'ok' | 'none' | 'misconfigured'> {
  const key = env('REVENUECAT_SECRET_KEY');
  if (!key) return 'ok';
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
    console.error('bank: RevenueCat sem resposta; liberado');
    return 'ok';
  }
  if (r.status === 401 || r.status === 403) {
    console.error('bank: RevenueCat recusou a chave', r.status);
    return 'misconfigured';
  }
  if (!r.ok) {
    console.error('bank: RevenueCat respondeu', r.status);
    return r.status === 429 || r.status >= 500 ? 'ok' : 'none';
  }
  let ent: RevenueCatEntitlement | undefined;
  try {
    const data = (await r.json()) as { subscriber?: { entitlements?: Record<string, RevenueCatEntitlement> } };
    ent = data.subscriber?.entitlements?.[env('REVENUECAT_ENTITLEMENT') || 'assinatura'];
  } catch {
    return 'ok';
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

/** Chave de API do provedor, guardada por uma hora e meia (ela vale duas). */
let cached: { key: string; until: number } | null = null;
export function _resetCache() {
  cached = null;
}

export async function handle(req: Request, env: Env, http: typeof fetch = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return fail(405, 'method');

  const base = env('SUPABASE_URL');
  const anon = req.headers.get('apikey') ?? env('SUPABASE_ANON_KEY');
  const clientId = env('PLUGGY_CLIENT_ID');
  const clientSecret = env('PLUGGY_CLIENT_SECRET');
  if (!base || !anon || !clientId || !clientSecret) return fail(503, 'not_configured');

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

  const supa = async (path: string, init: RequestInit = {}) => {
    const r = await http(`${base}${path}`, {
      ...init,
      headers: { Authorization: auth, apikey: anon, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    if (r.status === 401) throw new Stop(401, 'session');
    if (r.status === 404) {
      console.error('bank: tabela ou função ausente; aplique a migração dos bancos');
      throw new Stop(503, 'not_configured');
    }
    if (!r.ok) {
      console.error('bank: banco de dados respondeu', r.status);
      throw new Stop(502, 'unknown');
    }
    return r;
  };

  const apiKey = async () => {
    if (cached && cached.until > Date.now()) return cached.key;
    const r = await http(`${PLUGGY}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    if (!r.ok) {
      console.error('bank: autenticação no provedor falhou', r.status);
      throw new Stop(503, r.status === 401 || r.status === 403 ? 'not_configured' : 'busy');
    }
    const { apiKey: key } = (await r.json()) as { apiKey?: string };
    if (!key) throw new Stop(503, 'busy');
    cached = { key, until: Date.now() + 90 * 60_000 };
    return key;
  };

  const pluggy = async (path: string, init: RequestInit = {}): Promise<Json | null> => {
    const r = await http(`${PLUGGY}${path}`, {
      ...init,
      headers: { 'X-API-KEY': await apiKey(), 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    if (r.status === 404) return null;
    if (r.status === 401 || r.status === 403) {
      cached = null;
      console.error('bank: provedor recusou a chave', r.status);
      throw new Stop(503, 'busy');
    }
    if (r.status === 429 || r.status >= 500) {
      console.error('bank: provedor respondeu', r.status);
      throw new Stop(503, 'busy');
    }
    if (!r.ok) {
      console.error('bank: provedor respondeu', r.status);
      throw new Stop(502, 'unknown');
    }
    return r.status === 204 ? {} : ((await r.json()) as Json);
  };

  try {
    // quem é a pessoa: o próprio serviço de login confere o token
    const who = await supa('/auth/v1/user', { method: 'GET' });
    const uid = ((await who.json()) as { id?: string }).id;
    if (!uid) throw new Stop(401, 'session');

    // conectar e atualizar fazem parte da assinatura; desconectar fica sempre liberado
    if (body.action === 'token' || body.action === 'link' || body.action === 'sync' || body.action === 'refresh') {
      const paying = await subscription(uid, env, http);
      if (paying === 'misconfigured') throw new Stop(503, 'not_configured');
      if (paying === 'none') throw new Stop(402, 'subscription');
    }

    const owned = async (itemId: unknown) => {
      if (typeof itemId !== 'string' || !/^[\w-]{1,100}$/.test(itemId)) throw new Stop(400, 'invalid');
      const item = await pluggy(`/items/${itemId}`, { method: 'GET' });
      if (!item || item.clientUserId !== uid) throw new Stop(404, 'not_found');
      return item;
    };
    const myItems = async () => {
      const r = await supa('/rest/v1/bank_connections?select=item_id', { method: 'GET' });
      return ((await r.json()) as { item_id: string }[]).map((x) => x.item_id);
    };
    const rpc = (fn: string, args: Json) => supa(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });

    // apaga no provedor (encerra o acesso ao banco) e depois aqui
    const removeItem = async (id: string) => {
      const item = await pluggy(`/items/${id}`, { method: 'GET' });
      if (item && item.clientUserId === uid) await pluggy(`/items/${id}`, { method: 'DELETE' });
      await rpc('bank_unlink', { item_id: id });
    };

    switch (body.action) {
      case 'token': {
        const redirect =
          typeof body.redirect === 'string' && /^(baiu:\/\/|https:\/\/)/.test(body.redirect)
            ? body.redirect
            : undefined;
        if (body.itemId !== undefined) await owned(body.itemId);
        const res = await pluggy('/connect_token', {
          method: 'POST',
          body: JSON.stringify({
            ...(body.itemId ? { itemId: body.itemId } : {}),
            options: { clientUserId: uid, avoidDuplicates: true, ...(redirect ? { oauthRedirectUri: redirect } : {}) },
          }),
        });
        const token = res?.accessToken;
        if (typeof token !== 'string') throw new Stop(502, 'unknown');
        return json(200, { token, sandbox: env('PLUGGY_SANDBOX') === '1' });
      }

      case 'link': {
        if (typeof body.consentVersion !== 'string' || !VERSION_RE.test(body.consentVersion))
          throw new Stop(400, 'invalid');
        const item = await owned(body.itemId);
        const name = connectorName(item);
        await rpc('bank_link', { item_id: item.id, institution: name, version: body.consentVersion });
        return json(200, toItem(item));
      }

      case 'sync': {
        const since = body.since && typeof body.since === 'object' ? (body.since as Record<string, unknown>) : {};
        const out = {
          items: [] as Json[],
          accounts: [] as Json[],
          transactions: [] as Json[],
          investments: [] as Json[],
        };
        for (const id of await myItems()) {
          const item = await pluggy(`/items/${id}`, { method: 'GET' });
          if (!item || item.clientUserId !== uid) continue;
          out.items.push(toItem(item));
          const last = typeof since[id] === 'string' ? Date.parse(since[id] as string) : NaN;
          const from = new Date(Number.isNaN(last) ? Date.now() - FIRST_DAYS * DAY : last - OVERLAP_DAYS * DAY);
          const dateFrom = from.toISOString().slice(0, 10);

          const accounts = (await pluggy(`/accounts?itemId=${id}`, { method: 'GET' }))?.results;
          for (const a of Array.isArray(accounts) ? (accounts as Json[]) : []) {
            out.accounts.push(toAccount(a, id));
            let path: string | null = `/v2/transactions?accountId=${a.id}&dateFrom=${dateFrom}`;
            for (let page = 0; path && page < MAX_PAGES; page++) {
              const res = await pluggy(path, { method: 'GET' });
              for (const t of Array.isArray(res?.results) ? (res!.results as Json[]) : []) {
                if (t.status === 'PENDING') continue;
                out.transactions.push(toTx(t, String(a.id)));
              }
              const next = res?.next;
              // `next` traz a consulta da próxima página; dela só interessa o cursor `after`
              const after =
                typeof next === 'string' && next
                  ? (new URLSearchParams(next.slice(next.indexOf('?') + 1)).get('after') ?? next)
                  : null;
              path = after
                ? `/v2/transactions?accountId=${a.id}&dateFrom=${dateFrom}&after=${encodeURIComponent(after)}`
                : null;
            }
          }

          const inv = (await pluggy(`/investments?itemId=${id}&pageSize=500`, { method: 'GET' }))?.results;
          for (const i of Array.isArray(inv) ? (inv as Json[]) : []) {
            if (i.status === 'TOTAL_WITHDRAWAL') continue;
            out.investments.push(toInvestment(i, id));
          }
        }
        return json(200, out);
      }

      case 'refresh': {
        await owned(body.itemId);
        await pluggy(`/items/${body.itemId}`, { method: 'PATCH', body: JSON.stringify({}) });
        return json(200, { ok: true });
      }

      case 'unlink': {
        const mine = await myItems();
        if (typeof body.itemId !== 'string' || !mine.includes(body.itemId)) throw new Stop(404, 'not_found');
        await removeItem(body.itemId);
        return json(200, { ok: true });
      }

      case 'unlink_all': {
        for (const id of await myItems()) await removeItem(id);
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
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function connectorName(item: Json) {
  const c = item.connector as Json | undefined;
  return str(c?.name).slice(0, 120) || 'Banco';
}

function toItem(item: Json) {
  return {
    id: str(item.id),
    name: connectorName(item),
    status: str(item.status) || 'UPDATED',
    updatedAt: str(item.lastUpdatedAt) || null,
  };
}

/** Só o que o app usa. Sem titular, CPF ou número completo da conta. */
function toAccount(a: Json, itemId: string) {
  const bank = a.bankData as Json | undefined;
  const credit = a.creditData as Json | undefined;
  const number = str(a.number).replace(/\D/g, '');
  return {
    id: str(a.id),
    itemId,
    type: a.type === 'CREDIT' ? 'CREDIT' : 'BANK',
    subtype: str(a.subtype) || null,
    name: (str(a.marketingName) || str(a.name)).slice(0, 60),
    last4: number ? number.slice(-4) : null,
    balance: a.type === 'BANK' ? (num(bank?.closingBalance) ?? num(a.balance) ?? 0) : (num(a.balance) ?? 0),
    creditLimit: num(credit?.creditLimit),
    dueDate: str(credit?.balanceDueDate) || null,
  };
}

/** Do outro lado do Pix ou TED, só se é pessoa ou empresa: nem nome, nem documento. */
function toTx(t: Json, accountId: string) {
  const pay = t.paymentData as Json | undefined;
  const side = (t.type === 'CREDIT' ? pay?.payer : pay?.receiver) as Json | undefined;
  const doc = str((side?.documentNumber as Json | undefined)?.type).toLowerCase();
  return {
    id: str(t.id),
    accountId,
    date: str(t.date),
    description: str(t.description).slice(0, 120),
    amount: num(t.amount) ?? 0,
    type: t.type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
    category: str(t.category) || null,
    operationType: str(t.operationType) || null,
    party: doc === 'cpf' || doc === 'cnpj' ? doc : null,
  };
}

function toInvestment(i: Json, itemId: string) {
  return {
    id: str(i.id),
    itemId,
    name: str(i.name).slice(0, 60),
    type: str(i.type),
    subtype: str(i.subtype) || null,
    balance: num(i.balance) ?? 0,
    invested: num(i.amountOriginal) ?? num(i.amount),
  };
}

type DenoLike = {
  serve: (h: (r: Request) => Promise<Response>) => void;
  env: { get: (k: string) => string | undefined };
};
const deno = (globalThis as { Deno?: DenoLike }).Deno;
if (deno?.serve) deno.serve((req) => handle(req, (k) => deno.env.get(k)));
