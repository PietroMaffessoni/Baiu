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
const take = (limit = 3, version = '2026-10-15') => one(`select public.assistant_take($1, $2) as r`, [version, limit]).then((x) => x.r);

await as(ana);
ok('sem consentimento, a IA é recusada', (await take()).reason === 'consent');
ok('aceite com versão inválida é recusado', (await fails(`select public.assistant_consent(true, 'qualquer')`)) !== null);
ok('aceitar funciona', (await fails(`select public.assistant_consent(true, '2026-10-15')`)) === null);
const c = await one(`select count(*)::int as n from public.consents where document = 'assistente' and revoked_at is null`);
ok('aceite registrado, visível para a própria pessoa', c.n === 1, JSON.stringify(c));
ok('aceite de versão antiga não vale para a versão nova', (await take(3, '2026-11-01')).reason === 'consent');

const r1 = await take(3);
const r2 = await take(3);
const r3 = await take(3);
const r4 = await take(3);
ok('conta as perguntas do dia', r1.ok && r1.remaining === 2 && r2.remaining === 1 && r3.remaining === 0, JSON.stringify([r1, r2, r3]));
ok('passa do limite: recusa por cota', r4.ok === false && r4.reason === 'quota', JSON.stringify(r4));

ok('pessoa logada não lê o contador', (await fails(`select * from public.assistant_usage`)) !== null);
ok('pessoa logada não zera o contador', (await fails(`delete from public.assistant_usage`)) !== null);
ok('pessoa logada não grava aceite direto', (await fails(`insert into public.consents (user_id, document, version) values ($1, 'assistente', '2026-10-15')`, [ana])) !== null);

await as(bia);
ok('o limite é de cada pessoa', (await take(3)).reason === 'consent');
await fails(`select public.assistant_consent(true, '2026-10-15')`);
ok('outra pessoa tem a própria cota', (await take(3)).remaining === 2);
const seen = await one(`select count(*)::int as n from public.consents where document = 'assistente'`);
ok('cada pessoa só vê os próprios aceites', seen.n === 1, JSON.stringify(seen));

await as(ana);
ok('revogar funciona', (await fails(`select public.assistant_consent(false, null)`)) === null);
ok('depois de revogar, a IA é recusada', (await take(100)).reason === 'consent');
await fails(`select public.assistant_consent(true, '2026-10-15')`);
const hist = await one(`select count(*)::int as total, count(revoked_at)::int as revogados from public.consents where document = 'assistente'`);
ok('o histórico de aceites e revogações fica guardado', hist.total === 2 && hist.revogados === 1, JSON.stringify(hist));

await as(null);
ok('sem login: recusa por sessão', (await take()).reason === 'session');
ok('sem login: não registra aceite', (await fails(`select public.assistant_consent(true, '2026-10-15')`)) !== null);

await db.exec(`reset role`);
await db.exec(`set role anon`);
ok('visitante anônimo não chama a cota', /permission denied/.test((await fails(`select public.assistant_take('2026-10-15', 3)`)) ?? ''));
ok('visitante anônimo não chama o aceite', /permission denied/.test((await fails(`select public.assistant_consent(true, '2026-10-15')`)) ?? ''));

await db.exec(`reset role`);
await db.exec(`insert into public.assistant_usage (user_id, day, count) values ($1, current_date - 40, 9)`.replace('$1', `'${ana}'`));
await as(ana);
await take(100);
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
