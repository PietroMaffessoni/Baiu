// Testa a função bank (supabase/functions/bank/index.ts) em Node, com o
// banco de dados e a Polp simulados. Nada vai para a internet.
// Rodar: npm run test:sql
import { _resetCache, handle, validCpf } from '../supabase/functions/bank/index.ts';

const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'OK   ' : 'FALHA'} ${name}${cond ? '' : ' ' + extra}`);

// a assinatura é testada em test-subscription.mjs
const ENV = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'anon', POLP_CLIENT_ID: 'cid', POLP_CLIENT_SECRET: 'segredo', BAIU_SUBSCRIPTION_OFF: '1' };
const env = (over = {}) => (k) => ({ ...ENV, ...over })[k];
const UID = 'user-ana';
const CPF = '529.982.247-25';
const NUBANK = 'inst-nubank';
const soon = (min) => new Date(Date.now() + min * 60_000).toISOString();

/** Simula Supabase (login, tabela, funções) e a Polp. */
function world({
  owner = UID,
  rows = ['c-1'],
  revoked = [],
  status = 'AUTHORISED',
  execution = 'SUCCESS',
  polpStatus = 200,
  pages = 2,
  user = UID,
  existing = null,
  expiresAt = soon(60),
} = {}) {
  const calls = [];
  const res = (code, body) => new Response(body === undefined ? null : JSON.stringify(body), { status: code });
  const consent = (id, extra = {}) => ({
    id,
    cliente_user_id: owner,
    institution_id: NUBANK,
    status,
    execution_status: execution,
    products: ['ACCOUNT', 'CREDIT_CARD_ACCOUNT', 'INVESTMENTS'],
    url_to_authenticate: status === 'AWAITING_AUTHORIZATION' ? `https://banco.exemplo/autorizar/${id}` : null,
    url_to_authenticate_expires_at: expiresAt,
    updated_at: '2026-10-15T10:00:00Z',
    ...extra,
  });
  const list = (data, next = null) => ({ data, meta: { per_page: 15, next_cursor: next } });
  const http = async (url, init = {}) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method: init.method ?? 'GET', headers: init.headers ?? {}, body });
    if (u.host === 'proj.supabase.co') {
      if (u.pathname === '/auth/v1/user') return user ? res(200, { id: user }) : res(401, {});
      if (u.pathname === '/rest/v1/bank_connections') {
        const active = u.searchParams.get('revoked_at') === 'is.null';
        const all = [
          ...rows.map((item_id) => ({ item_id, institution: 'Nubank', created_at: '2026-10-15T10:00:00Z', revoked_at: null, products: ['ACCOUNT'] })),
          ...revoked.map((item_id) => ({ item_id, institution: 'Itaú', created_at: '2026-10-01T10:00:00Z', revoked_at: '2026-10-10T10:00:00Z', products: ['ACCOUNT'] })),
        ];
        return res(200, active ? all.filter((r) => !r.revoked_at) : all);
      }
      if (u.pathname.startsWith('/rest/v1/rpc/')) return res(200, null);
      return res(404, {});
    }
    if (u.host !== 'api.polp.com.br') return res(404, {});
    if (u.pathname === '/api/v2/institutions') {
      return res(200, {
        data: [
          { id: NUBANK, name: 'Nubank', status: 'OPERATIONAL', type: 'BOTH', logo_url: 'x', description: 'Banco' },
          { id: 'inst-fora', name: 'Banco Parado', status: 'MAJOR_OUTAGE', type: 'PERSONAL' },
          { id: 'inst-pj', name: 'Banco Só Empresas', status: 'OPERATIONAL', type: 'BUSINESS' },
        ],
      });
    }
    if (init.headers?.['x-api-client'] !== 'cid' || init.headers?.['x-api-secret'] !== 'segredo') return res(401, { message: 'Invalid API credentials.' });
    if (polpStatus !== 200) return res(polpStatus, { message: 'erro' });
    const path = u.pathname.replace(/^\/api\/v2(\/sandbox)?/, '');
    if (path === '/consents' && init.method === 'POST') {
      if (body.avoidDuplicates && existing) return res(201, { data: existing });
      return res(201, { data: consent('c-novo', { status: 'AWAITING_AUTHORIZATION', cliente_user_id: body.cliente_user_id, url_to_authenticate: 'https://banco.exemplo/autorizar/c-novo' }) });
    }
    const recreate = path.match(/^\/consents\/([\w-]+)\/recreate$/);
    if (recreate) return res(200, { data: consent(recreate[1], { status: 'AWAITING_AUTHORIZATION', url_to_authenticate: `https://banco.exemplo/de-novo/${recreate[1]}`, url_to_authenticate_expires_at: soon(60) }) });
    const show = path.match(/^\/consents\/([\w-]+)$/);
    if (show) {
      if (show[1] === 'sumiu') return res(404, { message: 'Not found' });
      if (init.method === 'DELETE') return res(200, { message: 'Consentimento revogado.' });
      return res(200, { data: consent(show[1]) });
    }
    if (/^\/consents\/[\w-]+\/accounts$/.test(path)) {
      return res(200, list([
        { id: 'acc-1', consent_id: 'c-1', number: '12345', branch_code: '0001', check_digit: '6', type: 'CONTA_DEPOSITO_A_VISTA', compe_code: '260', balance: { available_amount: { amount: '1500.50', currency: 'BRL' } } },
        { id: 'acc-2', consent_id: 'c-1', number: '99887', type: 'CONTA_POUPANCA', balance: { available_amount: { amount: '300.00', currency: 'BRL' } } },
      ]));
    }
    const accTx = path.match(/^\/accounts\/([\w-]+)\/transactions$/);
    if (accTx) {
      const page = Number(u.searchParams.get('cursor') ?? 0);
      const tx = (n) => ({
        id: `${accTx[1]}-t${page}-${n}`,
        transaction_name: 'PIX ENVIADO JOAO',
        transaction_date_time: '2026-10-10T12:00:00Z',
        type: 'PIX',
        credit_debit_type: 'DEBITO',
        transaction_amount: { amount: '50.00', currency: 'BRL' },
        partie_cnpj_cpf: '11122233344',
        partie_person_type: 'PESSOA_NATURAL',
        counterparty: null,
        category_ref: 'TRANSFER_OUT_TRANSFER_OUT_FROM_APPS',
      });
      return res(200, list([tx(1), tx(2)], page + 1 < pages ? String(page + 1) : null));
    }
    if (/^\/consents\/[\w-]+\/credit-cards$/.test(path)) {
      return res(200, list([
        {
          id: 'card-1',
          name: 'Ultravioleta',
          credit_card_network: 'MASTERCARD',
          payment_methods: [{ identification_number: '9876', is_multiple_credit_card: false }],
          limits: [
            { credit_line_limit_type: 'LIMITE_CREDITO_TOTAL', identification_number: '9876', used_amount: { amount: '800.00', currency: 'BRL' }, limit_amount: { amount: '5000.00', currency: 'BRL' }, available_amount: { amount: '4200.00', currency: 'BRL' } },
          ],
        },
      ]));
    }
    if (path === '/credit-cards/card-1/bills') {
      return res(200, list([
        { id: 'bill-2', due_date: '2026-10-20', bill_total_amount: { amount: '700.00', currency: 'BRL' } },
        { id: 'bill-1', due_date: '2026-09-20', bill_total_amount: { amount: '650.00', currency: 'BRL' } },
      ]));
    }
    if (path === '/credit-cards/card-1/transactions') {
      const base = { credit_card_id: 'card-1', identification_number: '9876', credit_debit_type: 'DEBITO', transaction_type: 'PAGAMENTO', bill_forecast_date: '2026-10' };
      return res(200, list([
        { ...base, id: 'ct-1', transaction_name: 'IFOOD *RESTAURANTE', brazilian_amount: { amount: '42.90', currency: 'BRL' }, transaction_date_time: '2026-10-05T20:00:00Z', bill_post_date: '2026-10-06', category_ref: 'FOOD_AND_DRINK_RESTAURANT' },
        { ...base, id: 'ct-2', transaction_name: 'MAGALU', brazilian_amount: { amount: '100.00', currency: 'BRL' }, transaction_date_time: '2026-08-01T15:00:00Z', bill_post_date: '2026-10-02', charge_identificator: 3, charge_number: 10 },
        { ...base, id: 'ct-3', transaction_name: 'MAGALU', brazilian_amount: { amount: '100.00', currency: 'BRL' }, transaction_date_time: '2026-08-01T15:00:00Z', bill_post_date: '0001-01-01', bill_id: null, charge_identificator: 4, charge_number: 10 },
      ]));
    }
    if (/^\/consents\/[\w-]+\/bank-fixed-incomes$/.test(path)) {
      return res(200, list([
        { id: 'inv-1', investment_type: 'CDB', due_date: '2027-03-15', issue_unit_price: { amount: '1000.00', currency: 'BRL' }, balance: { quantity: '1.000000', gross_amount: { amount: '1250.00', currency: 'BRL' }, net_amount: { amount: '1200.00', currency: 'BRL' } } },
        { id: 'inv-0', investment_type: 'CDB', balance: { quantity: '0', net_amount: { amount: '0.00', currency: 'BRL' } } },
      ]));
    }
    if (/^\/consents\/[\w-]+\/treasure-titles$/.test(path)) {
      return res(200, list([{ id: 'inv-2', product_name: 'Tesouro Selic 2029', balance: { quantity: '2.000000', net_amount: { amount: '30000.00', currency: 'BRL' }, purchase_unit_price: { amount: '14000.00', currency: 'BRL' } } }]));
    }
    if (/^\/consents\/[\w-]+\/(credit-fixed-incomes|funds|variable-incomes)$/.test(path)) return res(200, list([]));
    return res(404, { message: 'Not found' });
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
const START = { action: 'start', institutionId: NUBANK, cpf: CPF, consentVersion: '2026-10-23' };

// CPF
ok('cpf: válido com e sem pontuação', validCpf(CPF) && validCpf('52998224725'));
ok('cpf: dígito errado, repetido ou curto é recusado', !validCpf('52998224724') && !validCpf('111.111.111-11') && !validCpf('123'));

// bancos
{
  const r = await call({ action: 'institutions' });
  ok('institutions: lista os bancos de pessoa física', r.status === 200 && r.body.institutions.length === 2 && !r.body.institutions.some((i) => i.name === 'Banco Só Empresas'));
  ok('institutions: só nome, situação e id', JSON.stringify(r.body.institutions[0]) === JSON.stringify({ id: NUBANK, name: 'Nubank', status: 'OPERATIONAL' }));
}

// start
{
  const r = await call(START, world({ rows: [] }));
  const post = r.calls.find((c) => c.url === 'https://api.polp.com.br/api/v2/consents');
  const rpc = r.calls.find((c) => c.url.endsWith('/rpc/bank_link'));
  ok('start: devolve o endereço do banco', r.status === 200 && r.body.url === 'https://banco.exemplo/autorizar/c-novo' && r.body.id === 'c-novo' && r.body.name === 'Nubank' && r.body.sandbox === false);
  ok('start: autorização criada com o id da pessoa, o CPF só com números e as categorias certas', post.body.cliente_user_id === UID && post.body.cpf === '52998224725' && post.body.products.join() === 'ACCOUNT,CREDIT_CARD_ACCOUNT,INVESTMENTS' && post.body.avoidDuplicates === true);
  ok('start: sem endereço de volta configurado, não manda redirectUrl', !('redirectUrl' in post.body));
  ok('start: registra a autorização com o login da pessoa', rpc.body.item_id === 'c-novo' && rpc.body.version === '2026-10-23' && rpc.body.institution === 'Nubank' && rpc.headers.Authorization === 'Bearer token-da-pessoa');
  ok('start: as chaves da Polp não vão para o app', !JSON.stringify(r.body).includes('segredo'));
  ok('start: o CPF não vai para o banco de dados do Baiu', !r.calls.filter((c) => c.url.includes('supabase')).some((c) => JSON.stringify(c.body ?? '').includes('52998224725')));
}
{
  const r = await call(START, world(), env({ POLP_REDIRECT_URL: 'https://baiu.app/open-finance/' }));
  ok('start: com endereço de volta configurado, manda para a Polp', r.calls.find((c) => c.method === 'POST' && c.url.endsWith('/consents')).body.redirectUrl === 'https://baiu.app/open-finance/');
}
{
  const r = await call(START, world(), env({ POLP_REDIRECT_URL: 'baiu://open-finance' }));
  ok('start: endereço de volta que não é https é ignorado', !('redirectUrl' in r.calls.find((c) => c.method === 'POST' && c.url.endsWith('/consents')).body));
}
{
  const w = world({ existing: { id: 'c-velho', cliente_user_id: UID, status: 'AUTHORISED', execution_status: 'SUCCESS' } });
  const r = await call(START, w);
  ok('start: banco já autorizado segue direto, sem ir ao banco', r.status === 200 && r.body.id === 'c-velho' && r.body.url === null && r.body.status === 'AUTHORISED');
}
{
  const w = world({ existing: { id: 'c-alheio', cliente_user_id: 'outra', status: 'AUTHORISED' } });
  const r = await call(START, w);
  const posts = r.calls.filter((c) => c.method === 'POST' && c.url.endsWith('/consents'));
  ok('start: autorização de outra conta com o mesmo CPF não é reaproveitada', r.body.id === 'c-novo' && posts.length === 2 && posts[1].body.avoidDuplicates === false);
}
{
  const w = world({ existing: { id: 'c-pendente', cliente_user_id: UID, status: 'AWAITING_AUTHORIZATION', url_to_authenticate: 'https://velho', url_to_authenticate_expires_at: soon(2) } });
  const r = await call(START, w);
  ok('start: endereço do banco vencendo é renovado', r.body.url === 'https://banco.exemplo/de-novo/c-pendente' && r.calls.some((c) => c.url.endsWith('/consents/c-pendente/recreate')));
}
ok('start: CPF inválido é recusado antes da Polp', (await call({ ...START, cpf: '123.456.789-00' })).body?.error === 'cpf');
ok('start: banco desconhecido', (await call({ ...START, institutionId: 'inst-x' })).status === 404);
ok('start: banco só de empresas não aparece', (await call({ ...START, institutionId: 'inst-pj' })).status === 404);
ok('start: banco fora do ar avisa', (await call({ ...START, institutionId: 'inst-fora' })).body?.error === 'bank_down');
ok('start: sem versão do aceite, recusa', (await call({ ...START, consentVersion: undefined })).status === 400);
{
  const r = await call(START, world({ rows: [] }), env({ POLP_SANDBOX: '1' }));
  ok('start: no ambiente de teste, usa as rotas /sandbox e avisa o app', r.body.sandbox === true && r.calls.some((c) => c.url === 'https://api.polp.com.br/api/v2/sandbox/consents'));
}

// reconnect e status
{
  const r = await call({ action: 'reconnect', itemId: 'c-1', consentVersion: '2026-10-23' }, world({ status: 'EXPIRED' }));
  ok('reconnect: recria a mesma autorização e devolve o novo endereço', r.status === 200 && r.body.id === 'c-1' && r.body.url === 'https://banco.exemplo/de-novo/c-1' && r.body.name === 'Nubank');
  ok('reconnect: registra o novo aceite', r.calls.some((c) => c.url.endsWith('/rpc/bank_link') && c.body.item_id === 'c-1'));
}
ok('reconnect: autorização de outra pessoa é recusada', (await call({ action: 'reconnect', itemId: 'c-1', consentVersion: '2026-10-23' }, world({ owner: 'outra' }))).status === 404);
{
  const r = await call({ action: 'status', itemId: 'c-1' }, world({ status: 'AUTHORISED', execution: 'AWAITING_RESOURCES' }));
  ok('status: autorizado, com os dados ainda chegando', r.body.consent === 'AUTHORISED' && r.body.item.status === 'UPDATING' && r.body.item.name === 'Nubank');
}
ok('status: ainda esperando o banco', (await call({ action: 'status', itemId: 'c-1' }, world({ status: 'AWAITING_AUTHORIZATION' }))).body.consent === 'AWAITING_AUTHORIZATION');
ok('status: autorização de outra pessoa', (await call({ action: 'status', itemId: 'c-1' }, world({ owner: 'outra' }))).status === 404);
ok('status: identificador estranho, recusa', (await call({ action: 'status', itemId: '../../x' })).status === 400);
ok('status: autorização que não existe', (await call({ action: 'status', itemId: 'sumiu' })).status === 404);

// sync
{
  const r = await call({ action: 'sync', since: {} });
  const b = r.body;
  ok('sync: traz conexão, contas, cartão, movimentos e investimentos', r.status === 200 && b.items.length === 1 && b.accounts.length === 3 && b.investments.length === 2, JSON.stringify(b).slice(0, 300));
  ok('sync: conta corrente com o saldo disponível e o final', b.accounts[0].balance === 1500.5 && b.accounts[0].last4 === '2345' && b.accounts[0].type === 'BANK');
  ok('sync: poupança reconhecida', b.accounts[1].subtype === 'SAVINGS_ACCOUNT');
  const card = b.accounts[2];
  ok('sync: cartão com uso, limite, vencimento e final', card.type === 'CREDIT' && card.balance === 800 && card.creditLimit === 5000 && card.dueDate === '2026-10-20' && card.last4 === '9876');
  ok('sync: percorre todas as páginas das contas', b.transactions.filter((t) => t.accountId.startsWith('acc')).length === 8);
  const pix = b.transactions[0];
  ok('sync: movimento com valor positivo, sentido e categoria da Polp', pix.amount === 50 && pix.type === 'DEBIT' && pix.operationType === 'PIX' && pix.category === 'TRANSFER_OUT_TRANSFER_OUT_FROM_APPS');
  ok('sync: do outro lado só "pessoa" ou "empresa"', pix.party === 'cpf');
  const raw = JSON.stringify(b);
  ok('sync: sem CPF, agência ou número completo', !/11122233344|branch|0001"|12345"/.test(raw));
  ok('sync: parcela futura fica de fora', !b.transactions.some((t) => t.id === 'ct-3'));
  const parcela = b.transactions.find((t) => t.id === 'ct-2');
  ok('sync: parcela entra no mês da fatura, com o número dela', parcela.date === '2026-10-02T12:00:00Z' && parcela.description === 'MAGALU 3/10');
  ok('sync: compra à vista no cartão mantém a data da compra', b.transactions.find((t) => t.id === 'ct-1').date === '2026-10-05T20:00:00Z');
  ok('sync: investimento zerado fica de fora; CDB e Tesouro com valor aplicado', b.investments[0].invested === 1000 && b.investments[0].balance === 1200 && b.investments[0].name === 'CDB · vence 03/2027' && b.investments[1].type === 'TREASURY' && b.investments[1].invested === 28000);
  ok('sync: na primeira vez, todo o histórico', r.calls.some((c) => c.url.endsWith('/accounts/acc-1/transactions')));
}
{
  const recent = new Date(Date.now() - 3_600_000).toISOString();
  const r = await call({ action: 'sync', since: { 'c-1': recent } });
  const tx = r.calls.find((c) => c.url.includes('/accounts/acc-1/transactions'));
  ok('sync: depois, só o que entrou desde uma semana antes da última busca', new URL(tx.url).searchParams.get('fromCreatedAt') === new Date(Date.parse(recent) - 7 * 86_400_000).toISOString());
  ok('sync: investimentos só a cada 6 horas', !r.calls.some((c) => c.url.includes('fixed-incomes')));
}
{
  const r = await call({ action: 'sync', since: {} }, world({ owner: 'outra' }));
  ok('sync: autorização que não é da pessoa não é lida', r.status === 200 && r.body.items.length === 0 && !r.calls.some((c) => c.url.includes('/accounts')));
}
{
  const r = await call({ action: 'sync', since: {} }, world({ status: 'AWAITING_AUTHORIZATION' }));
  ok('sync: autorização não terminada não aparece como banco', r.body.items.length === 0);
}
{
  const r = await call({ action: 'sync', since: {} }, world({ status: 'EXPIRED' }));
  ok('sync: autorização vencida aparece para reconectar, sem ler dados', r.body.items[0]?.status === 'LOGIN_ERROR' && !r.calls.some((c) => c.url.includes('/accounts')));
}
{
  const r = await call({ action: 'sync', since: {} }, world({ pages: 50 }));
  ok('sync: no máximo 20 páginas por conta', r.calls.filter((c) => c.url.includes('/accounts/acc-1/transactions')).length === 20);
}

// histórico e cancelamento
{
  const r = await call({ action: 'history' }, world({ rows: ['c-1'], revoked: ['c-0'] }));
  const [a, b] = r.body.consents;
  ok('history: inclui as canceladas, com data e categorias', r.status === 200 && a.status === 'autorizada' && b.status === 'cancelada' && b.revokedAt === '2026-10-10T10:00:00Z' && b.products[0] === 'ACCOUNT');
  ok('history: não consulta a Polp para as já canceladas', !r.calls.some((c) => c.url.endsWith('/consents/c-0')));
}
{
  const r = await call({ action: 'unlink', itemId: 'c-1' });
  ok('unlink: revoga na Polp e marca aqui', r.status === 200 && r.calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/consents/c-1')) && r.calls.some((c) => c.url.endsWith('/rpc/bank_unlink')));
}
ok('unlink: autorização que não é da lista da pessoa, recusa', (await call({ action: 'unlink', itemId: 'c-9' })).status === 404);
{
  const r = await call({ action: 'unlink_all' }, world({ rows: ['c-1', 'c-2'] }));
  ok('unlink_all: cancela todas (exclusão de conta)', r.calls.filter((c) => c.method === 'DELETE').length === 2 && r.calls.filter((c) => c.url.endsWith('/rpc/bank_unlink')).length === 2);
}
{
  const r = await call({ action: 'unlink', itemId: 'c-1' }, world({ owner: 'outra' }));
  ok('unlink: não revoga na Polp o que não é da pessoa, mas marca aqui', r.status === 200 && !r.calls.some((c) => c.method === 'DELETE'));
}

// erros
ok('sem chaves da Polp: indisponível', (await call({ action: 'sync' }, world(), env({ POLP_CLIENT_SECRET: undefined }))).body.error === 'not_configured');
ok('chaves da Polp erradas: indisponível', (await call({ action: 'sync' }, world(), env({ POLP_CLIENT_SECRET: 'errado' }))).body.error === 'not_configured');
ok('plano da Polp inativo ou fatura atrasada: indisponível', (await call({ action: 'sync' }, world({ polpStatus: 402 }))).body.error === 'not_configured');
ok('Polp fora do ar: ocupado', (await call({ action: 'sync' }, world({ polpStatus: 503 }))).body.error === 'busy');
ok('limite de requisições da Polp: ocupado', (await call({ action: 'sync' }, world({ polpStatus: 429 }))).body.error === 'busy');
ok('Polp recusa o pedido: avisa', (await call(START, world({ polpStatus: 422 }))).body.error === 'refused');
ok('sem login: 401', (await call({ action: 'sync' }, world(), env(), { Authorization: '' })).status === 401);
ok('login vencido: 401', (await call({ action: 'sync' }, world({ user: null }))).status === 401);
ok('ação antiga ou desconhecida: 400', (await call({ action: 'token' })).status === 400 && (await call({ action: 'apagar_tudo' })).status === 400);
ok('corpo inválido: 400', (await call('{oi')).status === 400);
ok('preflight do navegador', (await handle(new Request('https://x/', { method: 'OPTIONS' }), env())).status === 204);

console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FALHA')) ? 1 : 0);
