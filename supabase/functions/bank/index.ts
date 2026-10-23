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
//   REVENUECAT_SECRET_KEY                com ela, só quem assina conecta e atualiza bancos
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
const VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[\w-]{1,100}$/;

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

/** Lista de bancos da Polp (é pública e muda pouco), guardada por uma hora. */
let cached: { list: Json[]; until: number } | null = null;
export function _resetCache() {
  cached = null;
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

export async function handle(req: Request, env: Env, http: typeof fetch = fetch): Promise<Response> {
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
      console.error('bank: tabela ou função ausente; aplique as migrações dos bancos');
      throw new Stop(503, 'not_configured');
    }
    if (!r.ok) {
      console.error('bank: banco de dados respondeu', r.status);
      throw new Stop(502, 'unknown');
    }
    return r;
  };

  /** Chamada à Polp. 404 vira null (autorização ou recurso que não existe mais). */
  const polp = async (path: string, init: RequestInit = {}, root = api): Promise<Json | null> => {
    const r = await http(`${root}${path}`, {
      ...init,
      headers: {
        'x-api-client': clientId,
        'x-api-secret': clientSecret,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
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

  const institutions = async () => {
    if (cached && cached.until > Date.now()) return cached.list;
    // a lista é pública e a mesma nos dois ambientes
    const r = await polp('/institutions', { method: 'GET' }, POLP);
    const list = (Array.isArray(r?.data) ? (r!.data as Json[]) : [])
      .filter((i) => typeof i.id === 'string' && typeof i.name === 'string' && i.type !== 'BUSINESS')
      .map((i) => ({ id: i.id, name: str(i.name).slice(0, 120), status: str(i.status) }));
    if (list.length) cached = { list, until: Date.now() + 3_600_000 };
    return list as Json[];
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
        const out = {
          items: [] as Json[],
          accounts: [] as Json[],
          transactions: [] as Json[],
          investments: [] as Json[],
        };
        for (const row of await rows(true)) {
          const id = row.item_id;
          const c = await consent(id);
          // autorização cancelada no banco, ou que a pessoa nunca terminou: não aparece como banco conectado
          if (!c || c.status === 'AWAITING_AUTHORIZATION' || c.status === 'REJECTED') continue;
          out.items.push(toItem(c, row.institution || 'Banco'));
          if (c.status !== 'AUTHORISED') continue;

          const last = typeof since[id] === 'string' ? Date.parse(since[id] as string) : NaN;
          const fresh = Number.isNaN(last);
          const from = fresh ? '' : `?fromCreatedAt=${new Date(last - OVERLAP_DAYS * DAY).toISOString()}`;

          for (const a of await all(`/consents/${id}/accounts`)) {
            if (typeof a.id !== 'string') continue;
            out.accounts.push(toAccount(a, id));
            for (const t of await all(`/accounts/${a.id}/transactions${from}`)) out.transactions.push(toTx(t, a.id));
          }

          for (const card of await all(`/consents/${id}/credit-cards`)) {
            if (typeof card.id !== 'string') continue;
            const bills = await polp(`/credit-cards/${card.id}/bills`, { method: 'GET' });
            out.accounts.push(toCard(card, id, Array.isArray(bills?.data) ? (bills!.data as Json[]) : []));
            for (const t of await all(`/credit-cards/${card.id}/transactions${from}`)) {
              const tx = toCardTx(t, card.id);
              if (tx) out.transactions.push(tx);
            }
          }

          if (fresh || Date.now() - last > INVESTMENTS_EVERY) {
            for (const [path, kind] of INVESTMENT_LISTS) {
              for (const i of await all(`/consents/${id}/${path}`)) {
                const inv = toInvestment(i, id, kind);
                if (inv) out.investments.push(inv);
              }
            }
          }
        }
        return json(200, out);
      }

      case 'history': {
        // todas as autorizações, inclusive canceladas: o Open Finance exige que a pessoa as veja
        const list = (await rows(false)).slice(0, 50);
        const out = [];
        for (const r of list) {
          let status = 'cancelada';
          if (!r.revoked_at) {
            const c = await consent(r.item_id);
            status = c ? consentStatus(str(c.status)) : 'cancelada';
          }
          out.push({
            id: r.item_id,
            name: r.institution || 'Banco',
            createdAt: r.created_at,
            revokedAt: r.revoked_at,
            products: Array.isArray(r.products) ? r.products : [],
            status,
          });
        }
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
