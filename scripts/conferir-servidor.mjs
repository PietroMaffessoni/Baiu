import fs from 'node:fs';

// Confere o Supabase do Baiu de fora, como o app enxerga: login, banco de
// dados, funções e as chaves da Polp e do RevenueCat. Usa só a URL e a chave
// publishable do .env.local (as duas são públicas); não cria contas, não
// grava nada e não mostra chave nenhuma. Rodar: npm run conferir
//
// O que só aparece por dentro (gatilhos, tarefa diária, Vault) fica no
// supabase/conferencia.sql, que roda no SQL Editor.

const env = {};
try {
  for (const line of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  // sem .env.local: o primeiro item avisa
}

let falhas = 0;
const item = (estado, texto, ajuda = '') => {
  if (estado === '❌') falhas++;
  console.log(`${estado} ${texto}${ajuda && estado !== '✅' ? `\n     → ${ajuda}` : ''}`);
};
const titulo = (t) => console.log(`\n== ${t}`);

const URL_ = (env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const KEY = env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

titulo('Arquivo .env.local');
const urlOk = /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(URL_);
item(urlOk ? '✅' : '❌', 'EXPO_PUBLIC_SUPABASE_URL', urlOk ? '' : 'Cole a URL do projeto (Project Settings, API Keys), no formato https://xxxx.supabase.co.');
const keyOk = KEY.startsWith('sb_publishable_') || KEY.startsWith('eyJ');
item(keyOk ? '✅' : '❌', 'EXPO_PUBLIC_SUPABASE_KEY', keyOk ? '' : 'Cole a chave publishable (começa com sb_publishable_). Nunca a secret.');
if (KEY.startsWith('sb_secret_')) item('❌', 'A chave do .env.local é a SECRETA', 'Troque pela publishable e gere uma secret nova no painel: esta pode ter vazado.');
if (env.EXPO_PUBLIC_AUTH_FAKE === '1')
  item('❌', 'O modo de teste (EXPO_PUBLIC_AUTH_FAKE=1) ainda está ligado', 'Apague essa linha, senão o app ignora o Supabase e usa contas e bancos de mentira.');
if (!urlOk || !keyOk) {
  console.log('\nSem URL e chave não dá para conferir o resto.');
  process.exit(1);
}

const call = async (path, init = {}) => {
  try {
    const r = await fetch(URL_ + path, { ...init, headers: { apikey: KEY, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
    const text = await r.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {}
    return { status: r.status, body, text };
  } catch (e) {
    return { status: 0, body: null, text: String(e) };
  }
};

titulo('Login (Authentication)');
const s = await call('/auth/v1/settings');
if (s.status !== 200 || !s.body?.external) {
  item('❌', `O servidor não respondeu (${s.status || 'sem conexão'})`, 'Confira a URL e a chave. Projeto pausado (plano grátis) também dá isso: Dashboard, Restore.');
} else {
  const ext = s.body.external;
  item(ext.email ? '✅' : '❌', 'Login por e-mail ligado', 'Authentication, Sign In / Providers, Email.');
  item(!s.body.mailer_autoconfirm ? '✅' : '❌', 'Confirmação de e-mail ligada (Confirm email)', 'Authentication, Sign In / Providers, Email: ligue Confirm email.');
  item(!s.body.disable_signup ? '✅' : '❌', 'Cadastro de contas novas liberado', 'Authentication: ligue Allow new users to sign up.');
  const extras = Object.entries(ext)
    .filter(([k, v]) => v === true && k !== 'email')
    .map(([k]) => k);
  item(extras.length === 0 ? '✅' : '❌', 'Telefone, login anônimo e redes sociais desligados', `Desligue em Authentication, Sign In / Providers: ${extras.join(', ')}.`);
}

titulo('Banco de dados (pelo lado de fora)');
const denied = (r) => (r.status === 401 || r.status === 403) && r.body?.code === '42501';
const missing = (r) => r.status === 404 || r.body?.code === 'PGRST202' || r.body?.code === 'PGRST205';
const t = await call('/rest/v1/consents?select=user_id&limit=1');
if (denied(t)) item('✅', 'Tabela consents existe e fica fechada para quem não entrou');
else if (missing(t)) item('❌', 'Tabela consents não encontrada', 'Rode as migrações (supabase/conferencia.sql mostra o que falta).');
else item('❌', `Tabela consents respondeu ${t.status} para quem não entrou`, 'Rode supabase/conferencia.sql e corrija o que aparecer com ❌.');

const rpc = async (nome, args, quem) => {
  const r = await call(`/rest/v1/rpc/${nome}`, { method: 'POST', body: JSON.stringify(args) });
  if (denied(r)) item('✅', `Função ${nome} existe e recusa quem não entrou`);
  else if (missing(r)) item('❌', `Função ${nome} não encontrada`, quem);
  else item('❌', `Função ${nome} respondeu ${r.status} para quem não entrou`, 'Rode supabase/conferencia.sql e corrija o que aparecer com ❌.');
};
await rpc('bank_link', { item_id: 'x', institution: 'x', version: 'x', products: [] }, 'Rode a migração 20261023120000_polp.sql.');
await rpc('bank_lapse', { p_user: '00000000-0000-0000-0000-000000000000', p_item: 'x' }, 'Rode a migração 20261027120000_bancos_sem_assinatura.sql.');
await rpc('delete_account', {}, 'Rode a migração 20261014120000_contas.sql.');

titulo('Funções (Edge Functions)');
const fn = async (nome, chaves, semChave) => {
  const r = await call(`/functions/v1/${nome}`, { method: 'POST', body: '{}' });
  if (r.status === 404) return item('❌', `Função ${nome} não publicada`, 'Edge Functions: publique (LEIA-ME, passo 6).');
  if (r.status === 401 && r.body?.error === 'session') return item('✅', `Função ${nome} publicada, com ${chaves}`);
  if (r.status === 503 && r.body?.error === 'not_configured') return item(semChave[0], `Função ${nome} publicada, mas sem ${chaves}`, semChave[1]);
  if (r.status === 401) return item('❌', `Função ${nome} com Verify JWT ligado`, `Edge Functions, ${nome}, Details: desligue Enforce JWT verification.`);
  item('❌', `Função ${nome} respondeu ${r.status || 'sem conexão'}`, 'Veja os logs da função no painel.');
};
await fn('bank', 'as chaves da Polp', ['❌', 'Edge Functions, Secrets: POLP_CLIENT_ID e POLP_CLIENT_SECRET (Pietro).']);
await fn('subscription', 'a chave do RevenueCat', [
  '⚠️',
  'Sem REVENUECAT_SECRET_KEY, os bancos ficam indisponíveis para todos. Para testar antes do RevenueCat, use BAIU_SUBSCRIPTION_OFF=1.',
]);
console.log('⚠️  POLP_SANDBOX, POLP_REDIRECT_URL, BANK_CLEANUP_SECRET e BAIU_SUBSCRIPTION_OFF não aparecem de fora: confira os nomes em Edge Functions, Secrets.');

titulo('Polp');
try {
  const r = await fetch('https://api.polp.com.br/api/v2/institutions', { headers: { Accept: 'application/json' } });
  const n = r.ok ? ((await r.json())?.data?.length ?? 0) : 0;
  item(n > 0 ? '✅' : '⚠️', n > 0 ? `API da Polp no ar (${n} bancos)` : `API da Polp respondeu ${r.status}`);
} catch {
  item('⚠️', 'Sem conexão com a API da Polp');
}

console.log(falhas ? `\n${falhas} item(ns) para ajustar.` : '\nTudo certo do lado de fora. Agora confira por dentro com supabase/conferencia.sql.');
process.exit(falhas ? 1 : 0);
