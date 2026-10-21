// Testa a assinatura no servidor, em Node, com Supabase, RevenueCat, Pluggy e
// IA simulados. Nada vai para a internet.
// - supabase/functions/subscription: apaga o cadastro no RevenueCat na exclusão da conta;
// - bank e baiu-chat: só quem assina usa o que custa dinheiro.
// Rodar: npm run test:sql
import { handle as bank, _resetCache, _resetSubscriptions as resetBank } from '../supabase/functions/bank/index.ts';
import { handle as chat, _resetSubscriptions as resetChat } from '../supabase/functions/baiu-chat/index.ts';
import { handle as subscription } from '../supabase/functions/subscription/index.ts';

const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'OK   ' : 'FALHA'} ${name}${cond ? '' : ' ' + extra}`);

const UID = 'user-ana';
const DAY = 86_400_000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const ENV = {
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  PLUGGY_CLIENT_ID: 'cid',
  PLUGGY_CLIENT_SECRET: 'segredo',
  ANTHROPIC_API_KEY: 'sk-ia',
  REVENUECAT_SECRET_KEY: 'sk_rc_secreta',
};
const env =
  (over = {}) =>
  (k) =>
    ({ ...ENV, ...over })[k];

/**
 * `ent`: o direito de uso no RevenueCat (null: nunca assinou).
 * `rc`: status HTTP do RevenueCat, ou 'cai' para simular rede fora.
 */
function world({
  ent = { expires_date: iso(20 * DAY), grace_period_expires_date: null },
  rc = 200,
  user = UID,
  del = 200,
} = {}) {
  const calls = [];
  const res = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status });
  const http = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({
      url,
      method: init.method ?? 'GET',
      headers: init.headers ?? {},
      body: init.body ? JSON.parse(init.body) : null,
    });
    if (u.host === 'api.revenuecat.com') {
      if (rc === 'cai') throw new TypeError('fetch failed');
      if (init.method === 'DELETE') return res(del, { app_user_id: UID, deleted: true });
      if (rc !== 200) return res(rc, {});
      return res(200, {
        subscriber: { entitlements: ent ? { assinatura: { product_identifier: 'baiu_mensal', ...ent } } : {} },
      });
    }
    if (u.host === 'proj.supabase.co') {
      if (u.pathname === '/auth/v1/user') return user ? res(200, { id: user }) : res(401, {});
      if (u.pathname === '/rest/v1/bank_connections') return res(200, [{ item_id: 'item-1' }]);
      if (u.pathname === '/rest/v1/rpc/assistant_take') return res(200, { ok: true, remaining: 5 });
      if (u.pathname.startsWith('/rest/v1/rpc/')) return res(200, null);
      return res(404, {});
    }
    if (u.host === 'api.pluggy.ai') {
      if (u.pathname === '/auth') return res(200, { apiKey: 'chave-pluggy' });
      if (u.pathname === '/connect_token') return res(200, { accessToken: 'token-de-conexao' });
      if (u.pathname.startsWith('/items/')) {
        if (init.method === 'DELETE') return res(204);
        return res(200, { id: 'item-1', clientUserId: UID, status: 'UPDATED', connector: { name: 'Nubank' } });
      }
      return res(200, { results: [] });
    }
    if (u.pathname === '/v1/messages')
      return res(200, { content: [{ type: 'text', text: 'Guarde 10%.' }], stop_reason: 'end_turn' });
    return res(404, {});
  };
  return { http, calls };
}

const req = (path, body, headers = {}) =>
  new Request(`https://proj.supabase.co/functions/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-da-pessoa',
      apikey: 'sb_publishable_x',
      'Content-Type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const run = async (fn, path, body, w, e = env(), headers = {}) => {
  const r = await fn(req(path, body, headers), e, w.http);
  let json = null;
  try {
    json = await r.json();
  } catch {}
  return { status: r.status, body: json, calls: w.calls };
};
const callBank = (body, w = world(), e) => {
  _resetCache();
  resetBank();
  return run(bank, 'bank', body, w, e);
};
const question = { messages: [{ role: 'user', content: 'Onde economizar?' }], consentVersion: '2026-10-15' };
const callChat = (w = world(), e) => {
  resetChat();
  return run(chat, 'baiu-chat', question, w, e);
};
const rcCalls = (calls) => calls.filter((c) => c.url.startsWith('https://api.revenuecat.com'));

// ---------- bancos ----------
{
  const r = await callBank({ action: 'sync', since: {} });
  const rc = rcCalls(r.calls)[0];
  ok('bancos: quem assina sincroniza', r.status === 200);
  ok(
    'bancos: confere no RevenueCat pelo id da conta, com a chave secreta',
    rc?.url === `https://api.revenuecat.com/v1/subscribers/${UID}` &&
      rc.headers.Authorization === 'Bearer sk_rc_secreta',
  );
  ok('bancos: a chave do RevenueCat não volta para o app', !JSON.stringify(r.body).includes('sk_rc'));
}
ok(
  'bancos: no mês grátis também funciona',
  (await callBank({ action: 'token' }, world({ ent: { expires_date: iso(10 * DAY), period_type: 'trial' } })))
    .status === 200,
);
{
  const r = await callBank({ action: 'sync', since: {} }, world({ ent: null }));
  ok(
    'bancos: sem assinatura, 402 e nada é lido no banco',
    r.status === 402 && r.body.error === 'subscription' && !r.calls.some((c) => c.url.includes('pluggy')),
  );
}
ok(
  'bancos: assinatura vencida, 402',
  (await callBank({ action: 'token' }, world({ ent: { expires_date: iso(-DAY) } }))).status === 402,
);
ok(
  'bancos: vencida mas no prazo de acerto do pagamento, libera',
  (
    await callBank(
      { action: 'refresh', itemId: 'item-1' },
      world({ ent: { expires_date: iso(-DAY), grace_period_expires_date: iso(5 * DAY) } }),
    )
  ).status === 200,
);
ok(
  'bancos: cortesia sem data de fim, libera',
  (await callBank({ action: 'token' }, world({ ent: { expires_date: null } }))).status === 200,
);
{
  const r = await callBank({ action: 'unlink', itemId: 'item-1' }, world({ ent: null }));
  ok('bancos: desconectar funciona mesmo sem assinatura (LGPD)', r.status === 200 && rcCalls(r.calls).length === 0);
}
ok(
  'bancos: excluir a conta desconecta tudo mesmo sem assinatura',
  (await callBank({ action: 'unlink_all' }, world({ ent: null }))).status === 200,
);
ok(
  'bancos: RevenueCat fora do ar não bloqueia quem paga',
  (await callBank({ action: 'token' }, world({ rc: 'cai' }))).status === 200,
);
ok(
  'bancos: RevenueCat com erro 500 também libera',
  (await callBank({ action: 'token' }, world({ rc: 500 }))).status === 200,
);
{
  const r = await callBank({ action: 'token' }, world({ rc: 401 }));
  ok('bancos: chave do RevenueCat recusada bloqueia e avisa', r.status === 503 && r.body.error === 'not_configured');
}
{
  const r = await callBank(
    { action: 'sync', since: {} },
    world({ ent: null }),
    env({ REVENUECAT_SECRET_KEY: undefined }),
  );
  ok(
    'bancos: sem a chave do RevenueCat no servidor, não há cobrança',
    r.status === 200 && rcCalls(r.calls).length === 0,
  );
}
{
  _resetCache();
  resetBank();
  const w = world();
  await bank(req('bank', { action: 'token' }), env(), w.http);
  await bank(req('bank', { action: 'token' }), env(), w.http);
  ok('bancos: guarda a conferência por alguns minutos', rcCalls(w.calls).length === 1);
}

// ---------- conversa com IA ----------
{
  const r = await callChat();
  ok('IA: quem assina conversa', r.status === 200 && r.body.text === 'Guarde 10%.', JSON.stringify(r.body));
}
{
  const r = await callChat(world({ ent: null }));
  ok(
    'IA: sem assinatura, 402 antes de gastar a cota ou chamar a IA',
    r.status === 402 &&
      r.body.error === 'subscription' &&
      !r.calls.some((c) => c.url.includes('assistant_take') || c.url.includes('/v1/messages')),
  );
}
ok('IA: login vencido, 401', (await callChat(world({ user: null }))).status === 401);
{
  const r = await callChat(world({ ent: null }), env({ REVENUECAT_SECRET_KEY: undefined }));
  ok(
    'IA: sem a chave do RevenueCat, segue como antes',
    r.status === 200 && rcCalls(r.calls).length === 0 && !r.calls.some((c) => c.url.endsWith('/auth/v1/user')),
  );
}
ok('IA: RevenueCat fora do ar não bloqueia', (await callChat(world({ rc: 'cai' }))).status === 200);

// ---------- exclusão da conta ----------
const forget = (w = world(), e = env(), headers = {}, body = { action: 'forget' }) =>
  run(subscription, 'subscription', body, w, e, headers);
{
  const r = await forget();
  const del = rcCalls(r.calls)[0];
  ok(
    'excluir: apaga o cadastro da pessoa no RevenueCat',
    r.status === 200 && del.method === 'DELETE' && del.url === `https://api.revenuecat.com/v1/subscribers/${UID}`,
  );
  ok(
    'excluir: usa a chave secreta, que não volta para o app',
    del.headers.Authorization === 'Bearer sk_rc_secreta' && !JSON.stringify(r.body).includes('sk_rc'),
  );
  ok(
    'excluir: confere o login antes',
    r.calls[0].url.endsWith('/auth/v1/user') && r.calls[0].headers.Authorization === 'Bearer token-da-pessoa',
  );
}
ok('excluir: sem cadastro no RevenueCat (404) também é sucesso', (await forget(world({ del: 404 }))).status === 200);
{
  const r = await forget(world({ user: null }));
  ok('excluir: login vencido não apaga nada', r.status === 401 && rcCalls(r.calls).length === 0);
}
ok('excluir: sem login, 401', (await forget(world(), env(), { Authorization: '' })).status === 401);
ok(
  'excluir: RevenueCat fora do ar, pede para tentar de novo',
  (await forget(world({ rc: 'cai' }))).body.error === 'busy',
);
ok('excluir: RevenueCat com erro, pede para tentar de novo', (await forget(world({ del: 500 }))).body.error === 'busy');
ok('excluir: chave recusada, indisponível', (await forget(world({ del: 401 }))).body.error === 'not_configured');
ok(
  'excluir: sem a chave no servidor, indisponível',
  (await forget(world(), env({ REVENUECAT_SECRET_KEY: undefined }))).body.error === 'not_configured',
);
ok('excluir: outra ação, 400', (await forget(world(), env(), {}, { action: 'apagar_outro', uid: 'x' })).status === 400);
ok('excluir: corpo inválido, 400', (await forget(world(), env(), {}, '{oi')).status === 400);
ok(
  'excluir: preflight do navegador',
  (await subscription(new Request('https://x/', { method: 'OPTIONS' }), env())).status === 204,
);

console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FALHA')) ? 1 : 0);
