import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

// Testa a migração dos bancos conectados num Postgres embutido (PGlite),
// por cima das migrações anteriores. Rodar: npm run test:sql
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
for (const f of ['20261014120000_contas.sql', '20261015120000_assistente.sql', '20261015130000_bancos.sql']) await db.exec(read(f));
await db.exec(read('20261015130000_bancos.sql'));
ok('migração dos bancos roda duas vezes sem erro', true);

const meta = JSON.stringify({ full_name: 'Maria Silva', phone: '+5511996421873', terms_version: '2026-10-15', privacy_version: '2026-10-15', adult: true });
await db.query(`insert into auth.users (email, raw_user_meta_data) values ('a@b.com', $1::jsonb), ('c@d.com', $1::jsonb)`, [meta]);
const [ana, bia] = (await db.query(`select id from auth.users order by email`)).rows.map((r) => r.id);
const as = async (uid) => {
  await db.exec(`set role authenticated`);
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ''}', false)`);
};

await as(ana);
ok('ligar conexão funciona', (await fails(`select public.bank_link('item-1', 'Nubank', '2026-10-15')`)) === null);
ok('ligar de novo não duplica', (await fails(`select public.bank_link('item-1', 'Nubank', '2026-10-15')`)) === null);
ok('versão inválida é recusada', (await fails(`select public.bank_link('item-2', 'Itaú', 'x')`)) !== null);
ok('versão que não é a atual é recusada', (await fails(`select public.bank_link('item-2', 'Itaú', '1999-01-01')`)) !== null);
ok('identificador vazio é recusado', (await fails(`select public.bank_link('', 'Itaú', '2026-10-15')`)) !== null);
await fails(`select public.bank_link('item-2', 'Itaú', '2026-10-15')`);
const mine = await one(`select count(*)::int as n from public.bank_connections`);
ok('a pessoa vê as próprias conexões', mine.n === 2, JSON.stringify(mine));
const cons = await one(`select count(*)::int as n from public.consents where document = 'conexao_bancaria' and revoked_at is null`);
ok('cada conexão tem seu aceite registrado', cons.n === 2, JSON.stringify(cons));
ok('não grava conexão direto na tabela', (await fails(`insert into public.bank_connections (user_id, item_id) values ($1, 'x')`, [ana])) !== null);
ok('não apaga conexão direto na tabela', (await fails(`delete from public.bank_connections`)) !== null || (await one(`select count(*)::int as n from public.bank_connections`)).n === 2);

await as(bia);
const other = await one(`select count(*)::int as n from public.bank_connections`);
ok('outra pessoa não vê as conexões da primeira', other.n === 0, JSON.stringify(other));
await fails(`select public.bank_unlink('item-1')`);
await as(ana);
ok('outra pessoa não consegue desligar conexão alheia', (await one(`select count(*)::int as n from public.bank_connections`)).n === 2);

ok('desligar funciona', (await fails(`select public.bank_unlink('item-1')`)) === null);
const after = await one(`select count(*)::int as n from public.bank_connections`);
const revoked = await one(`select count(*)::int as n from public.consents where document = 'conexao_bancaria' and reference = 'item-1' and revoked_at is not null`);
ok('desligar tira a conexão e encerra o aceite', after.n === 1 && revoked.n === 1, JSON.stringify([after, revoked]));

await as(null);
ok('sem login não liga conexão', (await fails(`select public.bank_link('item-9', 'X', '2026-10-15')`)) !== null);
await db.exec(`reset role`);
await db.exec(`set role anon`);
ok('visitante anônimo não chama as funções', /permission denied/.test((await fails(`select public.bank_link('i', 'X', '2026-10-15')`)) ?? ''));
ok('visitante anônimo não lê conexões', (await fails(`select * from public.bank_connections`)) !== null);

await db.exec(`reset role`);
await as(ana);
await fails(`select public.delete_account()`);
await db.exec(`reset role`);
const gone = await one(`select (select count(*) from public.bank_connections where user_id = $1)::int as b, (select count(*) from public.consents where user_id = $1)::int as c`, [ana]);
ok('excluir a conta apaga conexões e aceites', gone.b === 0 && gone.c === 0, JSON.stringify(gone));

console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FALHA')) ? 1 : 0);
