import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

// Testa o aceite de versões novas dos textos e a limpeza dos registros de acesso
// (migração 20261106120000) num Postgres embutido, depois da migração das contas.
// Rodar: npm run test:sql
const read = (f) => fs.readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8');
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

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb,
    last_sign_in_at timestamptz
  );
  create table auth.audit_log_entries (id uuid primary key default gen_random_uuid(), payload json, created_at timestamptz, ip_address varchar(64));
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);
await db.exec(read('20261014120000_contas.sql'));
await db.exec(read('20261015120000_assistente.sql'));
await db.exec(read('20261015130000_bancos.sql'));
const migration = read('20261106120000_aceites_e_registros.sql');
await db.exec(migration);
// rodar duas vezes não pode quebrar
await db.exec(migration);
ok('migração roda duas vezes sem erro, mesmo sem pg_cron', true);

const meta = { full_name: 'Maria Silva', phone: '+5511996421873', terms_version: '2026-10-27', privacy_version: '2026-11-06', adult: true };
await db.query(`insert into auth.users (email, raw_user_meta_data) values ('x@y.com', $1::jsonb)`, [JSON.stringify(meta)]);
const uid = (await db.query(`select id from auth.users`)).rows[0].id;
const versions = async (doc) =>
  (await db.query(`select version from public.consents where user_id = $1 and document = $2 order by id`, [uid, doc])).rows.map((r) => r.version);
const setMeta = (patch) =>
  fails(`update auth.users set raw_user_meta_data = raw_user_meta_data || $2::jsonb where id = $1`, [uid, JSON.stringify(patch)]);

ok('cadastro registra uma vez cada texto', (await versions('termos')).length === 1 && (await versions('privacidade')).length === 1);

await setMeta({ full_name: 'Maria Souza' });
ok('editar o nome não registra aceite', (await versions('termos')).length === 1 && (await versions('privacidade')).length === 1);

await setMeta({ privacy_version: '2026-11-06.2' });
ok('versão nova da política vira um aceite novo', (await versions('privacidade')).join() === '2026-11-06,2026-11-06.2', (await versions('privacidade')).join());
ok('os termos, sem versão nova, não mudam', (await versions('termos')).join() === '2026-10-27');

await setMeta({ terms_version: '2026-11-06', privacy_version: '2026-11-06.2' });
ok('versão nova dos termos vira um aceite novo', (await versions('termos')).join() === '2026-10-27,2026-11-06');
ok('aceitar de novo a mesma versão não duplica', (await versions('privacidade')).length === 2);

const bad = await setMeta({ terms_version: '2026-12-01', phone: '123' });
ok('aceite com dados inválidos é recusado e não registra', bad !== null && (await versions('termos')).length === 2, bad ?? 'aceitou');

await db.query(`update auth.users set last_sign_in_at = now() where id = $1`, [uid]);
ok('login não registra aceite', (await versions('termos')).length === 2);

// registros de acesso
await db.exec(`
  insert into auth.audit_log_entries (payload, created_at, ip_address) values
    ('{}', now() - interval '7 months', '200.1.1.1'),
    ('{}', now() - interval '6 months' - interval '1 day', '200.1.1.2'),
    ('{}', now() - interval '5 months', '200.1.1.3'),
    ('{}', now(), '200.1.1.4');
`);
const removed = (await db.query(`select public.baiu_cleanup_access_logs() as n`)).rows[0].n;
const left = (await db.query(`select ip_address from auth.audit_log_entries order by ip_address`)).rows.map((r) => r.ip_address);
ok('limpeza apaga só o que passou de 6 meses', removed === 2 && left.join() === '200.1.1.3,200.1.1.4', `${removed} ${left.join()}`);

await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
const call = await fails(`select public.baiu_cleanup_access_logs()`);
ok('o app não chama a limpeza', call !== null && /permission denied/.test(call), call ?? 'chamou');
const trig = await fails(`select public.baiu_record_new_consents()`);
ok('o gatilho não é chamável pelo app', trig !== null, trig ?? 'chamou');
ok('excluir a conta funciona', (await fails(`select public.delete_account()`)) === null);
await db.exec(`reset role;`);
const leftC = (await db.query(`select count(*)::int as n from public.consents`)).rows[0].n;
ok('aceites novos também saem com a conta', leftC === 0, String(leftC));

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FALHA')).length;
console.log(`\n${results.length - failed} de ${results.length} conferências dos aceites certas.`);
if (failed) process.exit(1);
