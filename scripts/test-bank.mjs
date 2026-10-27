// Testa a função bank (supabase/functions/bank/index.ts) em Node, com o
// banco de dados e a Pluggy simulados. Nada vai para a internet.
// Rodar: npm run test:sql
import { _resetCache, handle } from '../supabase/functions/bank/index.ts';

const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'OK   ' : 'FALHA'} ${name}${cond ? '' : ' ' + extra}`);

// a assinatura é testada em test-subscription.mjs
const ENV = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'anon', PLUGGY_CLIENT_ID: 'cid', PLUGGY_CLIENT_SECRET: 'segredo', BAIU_SUBSCRIPTION_OFF: '1' };
const env = (over = {}) => (k) => ({ ...ENV, ...over })[k];
const UID = 'user-ana';

/** Simula Supabase (login, tabela, funções) e Pluggy. */
function world({ owner = UID, rows = ['item-1'], pluggyAuth = 200, pages = 2, user = UID } = {}) {
  const calls = [];
  const res = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status });
  const http = async (url, init = {}) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method: init.method ?? 'GET', headers: init.headers ?? {}, body });
    if (u.host === 'proj.supabase.co') {
      if (u.pathname === '/auth/v1/user') return user ? res(200, { id: user }) : res(401, {});
      if (u.pathname === '/rest/v1/bank_connections') return res(200, rows.map((item_id) => ({ item_id })));
      if (u.pathname.startsWith('/rest/v1/rpc/')) return res(200, null);
      return res(404, {});
    }
    if (u.pathname === '/auth') return pluggyAuth === 200 ? res(200, { apiKey: 'chave-pluggy' }) : res(pluggyAuth, {});
    if (init.headers?.['X-API-KEY'] !== 'chave-pluggy') return res(403, {});
    if (u.pathname === '/connect_token') return res(200, { accessToken: 'token-de-conexao' });
    const item = u.pathname.match(/^\/items\/([\w-]+)$/);
    if (item) {
      if (item[1] === 'sumiu') return res(404, {});
      if (init.method === 'DELETE') return res(204);
      return res(200, { id: item[1], clientUserId: owner, status: 'UPDATED', lastUpdatedAt: '2026-10-15T10:00:00Z', connector: { id: 1, name: 'Nubank' } });
    }
    if (u.pathname === '/accounts') {
      return res(200, {
        results: [
          { id: 'acc-1', type: 'BANK', subtype: 'CHECKING_ACCOUNT', name: 'Conta', number: '0001/12345-6', owner: 'MARIA DA SILVA', taxNumber: '123.456.789-00', balance: 10, bankData: { closingBalance: 1500.5 } },
          { id: 'card-1', type: 'CREDIT', subtype: 'CREDIT_CARD', name: 'Ultravioleta', number: '5162********9876', balance: 800, creditData: { creditLimit: 5000, balanceDueDate: '2026-10-20' } },
        ],
      });
    }
    if (u.pathname === '/v2/transactions') {
      const after = u.searchParams.get('after');
      const acc = u.searchParams.get('accountId');
      const page = after ? Number(after) : 0;
      const tx = (n) => ({
        id: `${acc}-t${page}-${n}`,
        date: '2026-10-10T12:00:00Z',
        description: 'PIX ENVIADO JOAO',
        amount: -50,
        type: 'DEBIT',
        status: n === 2 ? 'PENDING' : 'POSTED',
        category: 'Transfer - PIX',
        operationType: 'PIX',
        paymentData: { receiver: { name: 'JOAO PEREIRA', documentNumber: { type: 'CPF', value: '111.222.333-44' } } },
      });
      return res(200, { results: [tx(1), tx(2)], next: page + 1 < pages ? `?accountId=${acc}&after=${page + 1}` : null });
    }
    if (u.pathname === '/investments') {
      return res(200, {
        results: [
          { id: 'inv-1', name: 'CDB Banco X', type: 'FIXED_INCOME', subtype: 'CDB', balance: 1200, amountOriginal: 1000, status: 'ACTIVE', owner: 'MARIA' },
          { id: 'inv-2', name: 'Antigo', type: 'FIXED_INCOME', subtype: 'CDB', balance: 0, status: 'TOTAL_WITHDRAWAL' },
        ],
      });
    }
    return res(404, {});
  };
  return { http, calls };
}

const req = (body, headers = {}) =>
  new Request('https://proj.supabase.co/functions/v1/bank', {
    method: 'POST',
    headers: { Authorization: 'Bearer token-da-pessoa', apikey: 'sb_publishable_x', 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const call = async (body, w = world(), e = env(), headers = {}) => {
  _resetCache();
  const r = await handle(req(body, headers), e, w.http);
  let json = null;
  try {
    json = await r.json();
  } catch {}
  return { status: r.status, body: json, calls: w.calls };
};

// token
{
  const r = await call({ action: 'token', redirect: 'baiu://open-finance' });
  const tok = r.calls.find((c) => c.url.endsWith('/connect_token'));
  ok('token: devolve o token do widget', r.status === 200 && r.body.token === 'token-de-conexao' && r.body.sandbox === false);
  ok('token: conexão criada com o id da pessoa', tok.body.options.clientUserId === UID && tok.body.options.avoidDuplicates === true);
  ok('token: volta para o app pelo link baiu://', tok.body.options.oauthRedirectUri === 'baiu://open-finance');
  ok('token: a chave da Pluggy não vai para o app', !JSON.stringify(r.body).includes('segredo') && !JSON.stringify(r.body).includes('chave-pluggy'));
}
{
  const r = await call({ action: 'token', redirect: 'http://site-malicioso.com' });
  const tok = r.calls.find((c) => c.url.endsWith('/connect_token'));
  ok('token: endereço de volta estranho é ignorado', tok.body.options.oauthRedirectUri === undefined);
}
ok('token: reconectar banco de outra pessoa é recusado', (await call({ action: 'token', itemId: 'item-1' }, world({ owner: 'outra' }))).status === 404);
ok('token: com sandbox ligado, avisa o app', (await call({ action: 'token' }, world(), env({ PLUGGY_SANDBOX: '1' }))).body.sandbox === true);

// link
{
  const r = await call({ action: 'link', itemId: 'item-1', consentVersion: '2026-10-15' });
  const rpc = r.calls.find((c) => c.url.endsWith('/rpc/bank_link'));
  ok('link: liga a conexão e registra o aceite', r.status === 200 && rpc.body.item_id === 'item-1' && rpc.body.institution === 'Nubank' && rpc.body.version === '2026-10-15');
  ok('link: grava com o login da pessoa', rpc.headers.Authorization === 'Bearer token-da-pessoa');
  ok('link: devolve a instituição', r.body.name === 'Nubank' && r.body.status === 'UPDATED');
}
{
  const r = await call({ action: 'link', itemId: 'item-1', consentVersion: '2026-10-15' }, world({ owner: 'outra' }));
  ok('link: conexão criada para outra pessoa é recusada', r.status === 404 && !r.calls.some((c) => c.url.includes('/rpc/')));
}
ok('link: sem versão do aceite, recusa', (await call({ action: 'link', itemId: 'item-1' })).status === 400);
ok('link: identificador estranho, recusa', (await call({ action: 'link', itemId: '../../x', consentVersion: '2026-10-15' })).status === 400);
ok('link: conexão que não existe', (await call({ action: 'link', itemId: 'sumiu', consentVersion: '2026-10-15' })).status === 404);

// sync
{
  const r = await call({ action: 'sync', since: {} });
  const b = r.body;
  ok('sync: traz conexão, contas, movimentos e investimentos', r.status === 200 && b.items.length === 1 && b.accounts.length === 2 && b.investments.length === 1, JSON.stringify(b).slice(0, 300));
  ok('sync: conta corrente com o saldo do fechamento', b.accounts[0].balance === 1500.5 && b.accounts[0].last4 === '3456');
  ok('sync: cartão com limite, vencimento e final', b.accounts[1].creditLimit === 5000 && b.accounts[1].dueDate === '2026-10-20' && b.accounts[1].last4 === '9876');
  ok('sync: percorre todas as páginas, sem os pendentes', b.transactions.length === 4, String(b.transactions.length));
  ok('sync: do outro lado só "pessoa" ou "empresa"', b.transactions[0].party === 'cpf');
  const raw = JSON.stringify(b);
  ok('sync: sem CPF, nome do titular ou de quem recebeu', !/123\.456|111\.222|MARIA DA SILVA|JOAO PEREIRA|taxNumber|owner/.test(raw));
  ok('sync: investimento resgatado por inteiro fica de fora', b.investments[0].invested === 1000);
  const tx = r.calls.find((c) => c.url.includes('/v2/transactions'));
  ok('sync: na primeira vez, um ano de histórico', new URL(tx.url).searchParams.get('dateFrom') === new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10));
}
{
  const r = await call({ action: 'sync', since: { 'item-1': '2026-10-15T10:00:00Z' } });
  const tx = r.calls.find((c) => c.url.includes('/v2/transactions'));
  ok('sync: depois, desde uma semana antes da última busca', new URL(tx.url).searchParams.get('dateFrom') === '2026-10-08');
}
{
  const r = await call({ action: 'sync', since: {} }, world({ owner: 'outra' }));
  ok('sync: conexão que não é da pessoa não é lida', r.status === 200 && r.body.items.length === 0 && !r.calls.some((c) => c.url.includes('/accounts')));
}
{
  const r = await call({ action: 'sync', since: {} }, world({ pages: 50 }));
  ok('sync: no máximo 20 páginas por conta', r.calls.filter((c) => c.url.includes('/v2/transactions')).length === 40);
}

// refresh e unlink
ok('refresh: pede atualização ao banco', (await call({ action: 'refresh', itemId: 'item-1' })).calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/items/item-1')));
ok('refresh: banco de outra pessoa, recusa', (await call({ action: 'refresh', itemId: 'item-1' }, world({ owner: 'outra' }))).status === 404);
{
  const r = await call({ action: 'unlink', itemId: 'item-1' });
  ok('unlink: apaga na Pluggy e desliga aqui', r.status === 200 && r.calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/items/item-1')) && r.calls.some((c) => c.url.endsWith('/rpc/bank_unlink')));
}
ok('unlink: conexão que não é da lista da pessoa, recusa', (await call({ action: 'unlink', itemId: 'item-9' })).status === 404);
{
  const r = await call({ action: 'unlink_all' }, world({ rows: ['item-1', 'item-2'] }));
  ok('unlink_all: desliga todas (exclusão de conta)', r.calls.filter((c) => c.method === 'DELETE').length === 2 && r.calls.filter((c) => c.url.endsWith('/rpc/bank_unlink')).length === 2);
}
{
  const r = await call({ action: 'unlink', itemId: 'item-1' }, world({ owner: 'outra' }));
  ok('unlink: não apaga na Pluggy o que não é da pessoa, mas limpa a lista', r.status === 200 && !r.calls.some((c) => c.method === 'DELETE'));
}

// erros
ok('sem chaves da Pluggy: indisponível', (await call({ action: 'sync' }, world(), env({ PLUGGY_CLIENT_SECRET: undefined }))).body.error === 'not_configured');
ok('chaves da Pluggy erradas: indisponível', (await call({ action: 'sync' }, world({ pluggyAuth: 401 }))).body.error === 'not_configured');
ok('Pluggy fora do ar: ocupado', (await call({ action: 'sync' }, world({ pluggyAuth: 503 }))).body.error === 'busy');
ok('sem login: 401', (await call({ action: 'sync' }, world(), env(), { Authorization: '' })).status === 401);
ok('login vencido: 401', (await call({ action: 'sync' }, world({ user: null }))).status === 401);
ok('ação desconhecida: 400', (await call({ action: 'apagar_tudo' })).status === 400);
ok('corpo inválido: 400', (await call('{oi')).status === 400);
ok('preflight do navegador', (await handle(new Request('https://x/', { method: 'OPTIONS' }), env())).status === 204);

console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FALHA')) ? 1 : 0);
