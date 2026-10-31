import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

// Testa a migração do assistente (consentimento da IA e limite diário) num
// Postgres embutido (PGlite), por cima da migração das contas.
// Rodar: npm run test:sql
const read = (f) => fs.readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8');
const contas = read('20261014120000_contas.sql');
const assistente = read('20261015120000_assistente.sql');
const db = new PGlite();
const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'OK   ' : 'FALHA'} ${name}${cond ? '' : ' ' + extra}`);
const fails = async (sql, params = []) => {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return e.message;
  }
};
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);
await db.exec(contas);
await db.exec(assistente);
await db.exec(assistente);
ok('migração do assistente roda duas vezes sem erro', true);

const meta = JSON.stringify({ full_name: 'Maria Silva', phone: '+5511996421873', terms_version: '2026-10-14', privacy_version: '2026-10-14', adult: true });
await db.query(`insert into auth.users (email, raw_user_meta_data) values ('a@b.com', $1::jsonb), ('c@d.com', $1::jsonb)`, [meta]);
const { rows } = await db.query(`select id from auth.users order by email`);
const [ana, bia] = rows.map((r) => r.id);
const as = async (uid) => {
  await db.exec(`set role authenticated`);
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ''}', false)`);
};
const take = () => one(`select public.assistant_take() as r`).then((x) => x.r);
const setLimit = async (n) => {
  await db.exec(`reset role`);
  await db.query(`update public.baiu_config set assistant_daily_limit = $1`, [n]);
};
const setVersion = async (v) => {
  await db.exec(`reset role`);
  await db.query(`update public.baiu_config set assistant_consent_version = $1`, [v]);
};

await setLimit(3);
const cfg = await one(`select * from public.baiu_config`);
ok('configuração: versão do termo e limite no banco', cfg.assistant_consent_version === '2026-10-15' && cfg.assistant_daily_limit === 3, JSON.stringify(cfg));
await db.exec(assistente);
ok('rodar a migração de novo mantém o limite escolhido', (await one(`select assistant_daily_limit as n from public.baiu_config`)).n === 3);
ok('a função antiga, que recebia o limite de quem chama, não existe', (await fails(`select public.assistant_take('2026-10-15', 1000)`)) !== null);

await as(ana);
ok('sem consentimento, a IA é recusada', (await take()).reason === 'consent');
ok('aceite com versão inválida é recusado', (await fails(`select public.assistant_consent(true, 'qualquer')`)) !== null);
ok('aceite de versão que não é a atual é recusado', (await fails(`select public.assistant_consent(true, '1999-01-01')`)) !== null);
ok('aceite sem versão é recusado', (await fails(`select public.assistant_consent(true, null)`)) !== null);
ok('aceitar funciona', (await fails(`select public.assistant_consent(true, '2026-10-15')`)) === null);
const c = await one(`select count(*)::int as n from public.consents where document = 'assistente' and revoked_at is null`);
ok('aceite registrado, visível para a própria pessoa', c.n === 1, JSON.stringify(c));
await setVersion('2026-11-01');
await as(ana);
ok('termo novo: o aceite antigo deixa de valer', (await take()).reason === 'consent');
await setVersion('2026-10-15');
await as(ana);

const r1 = await take();
const r2 = await take();
const r3 = await take();
const r4 = await take();
ok('conta as perguntas do dia', r1.ok && r1.remaining === 2 && r2.remaining === 1 && r3.remaining === 0, JSON.stringify([r1, r2, r3]));
ok('passa do limite: recusa por cota', r4.ok === false && r4.reason === 'quota', JSON.stringify(r4));

ok('pessoa logada não lê o contador', (await fails(`select * from public.assistant_usage`)) !== null);
ok('pessoa logada não zera o contador', (await fails(`delete from public.assistant_usage`)) !== null);
ok('pessoa logada não lê a configuração', (await fails(`select * from public.baiu_config`)) !== null);
ok('pessoa logada não muda o limite', (await fails(`update public.baiu_config set assistant_daily_limit = 1000`)) !== null);
ok('pessoa logada não grava aceite direto', (await fails(`insert into public.consents (user_id, document, version) values ($1, 'assistente', '2026-10-15')`, [ana])) !== null);

await as(bia);
ok('o limite é de cada pessoa', (await take()).reason === 'consent');
await fails(`select public.assistant_consent(true, '2026-10-15')`);
ok('outra pessoa tem a própria cota', (await take()).remaining === 2);
const seen = await one(`select count(*)::int as n from public.consents where document = 'assistente'`);
ok('cada pessoa só vê os próprios aceites', seen.n === 1, JSON.stringify(seen));

await as(ana);
ok('revogar funciona', (await fails(`select public.assistant_consent(false, null)`)) === null);
ok('depois de revogar, a IA é recusada', (await take()).reason === 'consent');
await fails(`select public.assistant_consent(true, '2026-10-15')`);
const hist = await one(`select count(*)::int as total, count(revoked_at)::int as revogados from public.consents where document = 'assistente'`);
ok('o histórico de aceites e revogações fica guardado', hist.total === 2 && hist.revogados === 1, JSON.stringify(hist));

await as(null);
ok('sem login: recusa por sessão', (await take()).reason === 'session');
ok('sem login: não registra aceite', (await fails(`select public.assistant_consent(true, '2026-10-15')`)) !== null);

await db.exec(`reset role`);
await db.exec(`set role anon`);
ok('visitante anônimo não chama a cota', /permission denied/.test((await fails(`select public.assistant_take()`)) ?? ''));
ok('visitante anônimo não lê a configuração', /permission denied/.test((await fails(`select * from public.baiu_config`)) ?? ''));
ok('visitante anônimo não chama o aceite', /permission denied/.test((await fails(`select public.assistant_consent(true, '2026-10-15')`)) ?? ''));

await db.exec(`reset role`);
await db.exec(`insert into public.assistant_usage (user_id, day, count) values ($1, current_date - 40, 9)`.replace('$1', `'${ana}'`));
await setLimit(100);
await as(ana);
await take();
await db.exec(`reset role`);
const old = await one(`select count(*)::int as n from public.assistant_usage where user_id = $1 and day < current_date - 30`, [ana]);
ok('contadores com mais de 30 dias são apagados', old.n === 0, JSON.stringify(old));

await as(ana);
await fails(`select public.delete_account()`);
await db.exec(`reset role`);
const gone = await one(`select (select count(*) from public.assistant_usage where user_id = $1)::int as u, (select count(*) from public.consents where user_id = $1)::int as c`, [ana]);
ok('excluir a conta apaga contador e aceites', gone.u === 0 && gone.c === 0, JSON.stringify(gone));

console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FALHA')) ? 1 : 0);
