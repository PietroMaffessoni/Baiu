// Servidor local para os testes de carga: roda as funções do Supabase de
// verdade (supabase/functions) e simula o que fica do lado de fora (login,
// banco de dados, Polp e RevenueCat), com tempos de resposta realistas.
// Nada vai para a internet e nada é cobrado.
//
// Cada chamada aos serviços de fora é contada: quantas foram, quantas ao mesmo
// tempo no pico e quanto demoraram. É aí que aparece o gargalo, porque a
// função em si quase não gasta processamento.
//
// Sozinho: node carga/servidor.mjs   (porta 54321; outra: CARGA_PORTA)
// Normalmente quem sobe é o carga/rodar.mjs.
import { createServer } from 'node:http';

import * as bank from '../supabase/functions/bank/index.ts';
import * as subscription from '../supabase/functions/subscription/index.ts';

/**
 * Tempos médios de resposta dos serviços de fora, em ms. Chute conservador,
 * na mesma região: o login e o banco de dados ficam no próprio Supabase; a
 * Polp passa pela Celcoin. Troque pelos números medidos no ambiente de teste
 * da Polp quando houver credencial (CARGA_POLP_MS).
 */
export const LATENCIAS = {
  login: 40,
  banco: 25,
  assinatura: 120,
  polp: Number(process.env.CARGA_POLP_MS) || 220,
  polpBancos: 400,
};

const ENV = {
  SUPABASE_URL: 'https://carga.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  POLP_CLIENT_ID: 'cid',
  POLP_CLIENT_SECRET: 'segredo',
  REVENUECAT_SECRET_KEY: 'sk_carga',
  BAIU_ALERTA_URL: 'https://alerta.carga/webhook',
};

const realWarn = console.warn;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Variação de ±30% e, em 2% das vezes, uma resposta bem mais lenta (a cauda que pesa no p99). */
const jitter = (base) => base * (0.7 + Math.random() * 0.6) * (Math.random() < 0.02 ? 4 : 1);

export function createWorld(lat = LATENCIAS) {
  const stats = new Map();
  const alerts = [];
  const started = Date.now();
  // cada resposta lenta vira uma linha de log; aqui só conta, para não encher a tela
  let slowLogs = 0;
  console.warn = (line, ...rest) => (String(line).includes('"alerta":"lento"') ? slowLogs++ : realWarn(line, ...rest));
  const track = async (service, ms, fn) => {
    const s = stats.get(service) ?? { calls: 0, inflight: 0, peak: 0, total: 0, max: 0 };
    stats.set(service, s);
    s.calls++;
    s.inflight++;
    s.peak = Math.max(s.peak, s.inflight);
    const t = Date.now();
    try {
      await sleep(jitter(ms));
      return fn();
    } finally {
      s.inflight--;
      const d = Date.now() - t;
      s.total += d;
      s.max = Math.max(s.max, d);
    }
  };
  const res = (code, body) => new Response(body === undefined ? null : JSON.stringify(body), { status: code });
  const list = (data, next = null) => res(200, { data, meta: { per_page: 15, next_cursor: next } });

  // pessoa de teste n: token "carga-n", id "user-n", dois bancos (cN-1 e cN-2)
  const userOf = (auth) => /^Bearer carga-(\d+)$/.exec(auth ?? '')?.[1];
  const ownerOf = (consentId) => `user-${/^c(\d+)-/.exec(consentId)?.[1] ?? 'x'}`;
  const institutions = Array.from({ length: 150 }, (_, i) => ({
    id: `inst-${i}`,
    name: `Banco ${i}`,
    status: i % 40 === 7 ? 'MAJOR_OUTAGE' : 'OPERATIONAL',
    type: i % 10 === 3 ? 'BUSINESS' : 'BOTH',
    logo_url: `https://polp.exemplo/logo/${i}.png`,
    description: 'Instituição participante do Open Finance',
  }));

  const tx = (accountId, page, n) => ({
    id: `${accountId}-t${page}-${n}`,
    transaction_name: n % 3 ? 'PIX ENVIADO JOAO' : 'SUPERMERCADO BOM PRECO',
    transaction_date_time: '2026-11-01T12:00:00Z',
    type: 'PIX',
    credit_debit_type: n % 5 ? 'DEBITO' : 'CREDITO',
    transaction_amount: { amount: `${(n * 13.7).toFixed(2)}`, currency: 'BRL' },
    partie_person_type: 'PESSOA_NATURAL',
    category_ref: 'TRANSFER_OUT_TRANSFER_OUT_FROM_APPS',
  });

  const supabase = (u, init) => {
    if (u.pathname === '/auth/v1/user') {
      return track('login', lat.login, () => {
        const n = userOf(init.headers?.Authorization);
        return n ? res(200, { id: `user-${n}` }) : res(401, {});
      });
    }
    if (u.pathname === '/rest/v1/bank_connections') {
      return track('banco', lat.banco, () => {
        const n = userOf(init.headers?.Authorization);
        return res(
          200,
          [1, 2].map((k) => ({
            item_id: `c${n}-${k}`,
            institution: k === 1 ? 'Nubank' : 'Itaú',
            created_at: '2026-10-15T10:00:00Z',
            revoked_at: null,
            products: ['ACCOUNT'],
          })),
        );
      });
    }
    if (u.pathname.startsWith('/rest/v1/rpc/')) return track('banco', lat.banco, () => res(200, null));
    return res(404, {});
  };

  const polp = (u) => {
    if (u.pathname === '/api/v2/institutions')
      return track('polp: lista de bancos', lat.polpBancos, () => res(200, { data: institutions }));
    return track('polp', lat.polp, () => {
      const path = u.pathname.replace(/^\/api\/v2/, '');
      let m;
      if ((m = /^\/consents\/([\w-]+)$/.exec(path))) {
        return res(200, {
          data: {
            id: m[1],
            cliente_user_id: ownerOf(m[1]),
            institution_id: 'inst-1',
            status: 'AUTHORISED',
            execution_status: 'SUCCESS',
            updated_at: '2026-11-07T10:00:00Z',
          },
        });
      }
      if ((m = /^\/consents\/([\w-]+)\/accounts$/.exec(path))) {
        return list(
          [1, 2].map((k) => ({
            id: `${m[1]}-a${k}`,
            number: '12345',
            type: k === 1 ? 'CONTA_DEPOSITO_A_VISTA' : 'CONTA_POUPANCA',
            balance: { available_amount: { amount: '1500.50', currency: 'BRL' } },
          })),
        );
      }
      if ((m = /^\/accounts\/([\w-]+)\/transactions$/.exec(path))) {
        // primeira busca: 3 páginas; atualização (fromCreatedAt): 1
        const pages = u.searchParams.has('fromCreatedAt') ? 1 : 3;
        const page = Number(u.searchParams.get('cursor') ?? 0);
        return list(
          Array.from({ length: 15 }, (_, n) => tx(m[1], page, n)),
          page + 1 < pages ? String(page + 1) : null,
        );
      }
      if ((m = /^\/consents\/([\w-]+)\/credit-cards$/.exec(path))) {
        return list([
          {
            id: `${m[1]}-k`,
            name: 'Cartão',
            payment_methods: [{ identification_number: '9876' }],
            limits: [
              {
                credit_line_limit_type: 'LIMITE_CREDITO_TOTAL',
                used_amount: { amount: '800.00' },
                limit_amount: { amount: '5000.00' },
              },
            ],
          },
        ]);
      }
      if (/^\/credit-cards\/[\w-]+\/bills$/.test(path)) return list([{ id: 'b1', due_date: '2026-11-20' }]);
      if ((m = /^\/credit-cards\/([\w-]+)\/transactions$/.exec(path))) {
        return list(
          Array.from({ length: 10 }, (_, n) => ({
            id: `${m[1]}-ct${n}`,
            transaction_name: 'IFOOD *RESTAURANTE',
            brazilian_amount: { amount: '42.90' },
            transaction_date_time: '2026-11-05T20:00:00Z',
            bill_post_date: '2026-11-06',
            credit_debit_type: 'DEBITO',
          })),
        );
      }
      if (
        /^\/consents\/[\w-]+\/(bank-fixed-incomes|credit-fixed-incomes|funds|treasure-titles|variable-incomes)$/.test(
          path,
        )
      ) {
        return list([
          { id: 'inv', investment_type: 'CDB', balance: { quantity: '1', net_amount: { amount: '1200.00' } } },
        ]);
      }
      return res(404, {});
    });
  };

  const revenuecat = () =>
    track('assinatura', lat.assinatura, () =>
      res(200, { subscriber: { entitlements: { assinatura: { expires_date: '2099-01-01T00:00:00Z' } } } }),
    );

  const http = async (url, init = {}) => {
    const u = new URL(url);
    if (u.host === 'carga.supabase.co') return supabase(u, init);
    if (u.host === 'api.polp.com.br') return polp(u);
    if (u.host === 'api.revenuecat.com') return revenuecat();
    if (u.host === 'alerta.carga') {
      alerts.push(JSON.parse(init.body));
      return res(204);
    }
    return res(404, {});
  };

  const report = () => {
    const secs = (Date.now() - started) / 1000;
    const servicos = {};
    for (const [name, s] of stats) {
      servicos[name] = {
        chamadas: s.calls,
        porSegundo: Math.round(s.calls / secs),
        picoSimultaneas: s.peak,
        mediaMs: s.calls ? Math.round(s.total / s.calls) : 0,
        maxMs: s.max,
      };
    }
    return {
      segundos: Math.round(secs),
      servicos,
      lentasNoLog: slowLogs,
      alertas: alerts.length,
      exemplosDeAlerta: alerts.slice(0, 3).map((a) => a.text),
    };
  };
  return { http, report };
}

const FUNCTIONS = { bank: bank.handle, subscription: subscription.handle };

export function startServer({ port = Number(process.env.CARGA_PORTA) || 54321, lat = LATENCIAS } = {}) {
  // as funções guardam cache e o horário do último aviso em memória: cada rodada começa do zero
  bank._resetCache();
  bank._resetSubscriptions();
  bank._resetAlerts();
  const world = createWorld(lat);
  const env = (k) => ENV[k];
  const server = createServer(async (req, out) => {
    try {
      if (req.url === '/__carga/relatorio') {
        out.writeHead(200, { 'Content-Type': 'application/json' });
        return out.end(JSON.stringify(world.report()));
      }
      const name = /^\/functions\/v1\/([\w-]+)$/.exec(req.url ?? '')?.[1];
      const fn = name && FUNCTIONS[name];
      if (!fn) {
        out.writeHead(404);
        return out.end();
      }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      const request = new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers: Object.entries(req.headers).filter(([, v]) => typeof v === 'string'),
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
      });
      const res = await fn(request, env, world.http);
      out.writeHead(res.status, Object.fromEntries(res.headers));
      out.end(Buffer.from(await res.arrayBuffer()));
    } catch (e) {
      console.error('servidor de carga:', e);
      out.writeHead(500);
      out.end();
    }
  });
  server.keepAliveTimeout = 65_000;
  return new Promise((resolve) => server.listen(port, () => resolve({ server, world, port })));
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/').replace(/^\/?/, '/')}`) {
  const { port } = await startServer();
  console.log(`servidor de carga em http://localhost:${port}/functions/v1/bank`);
}
