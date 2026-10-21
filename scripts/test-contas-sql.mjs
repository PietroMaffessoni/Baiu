import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

// Testa a migração das contas num Postgres embutido (PGlite), com um esquema auth parecido com o do Supabase.
// Rodar: npm run test:sql
const migration = fs.readFileSync(new URL('../supabase/migrations/20261014120000_contas.sql', import.meta.url), 'utf8');
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

// ambiente parecido com o do Supabase
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb,
    last_sign_in_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- projeto criado com "Automatically expose new tables" desligado: sem permissões automáticas em tabelas
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);
await db.exec(migration);
// rodar duas vezes não pode quebrar
await db.exec(migration);
ok('migração roda duas vezes sem erro', true);

const meta = (p = {}) =>
  JSON.stringify({ full_name: 'Maria Silva', phone: '+5511996421873', terms_version: '2026-10-14', privacy_version: '2026-10-14', adult: true, ...p });
const insert = (m) => fails(`insert into auth.users (email, raw_user_meta_data) values ('x@y.com', $1::jsonb)`, [m]);

{ const e = await insert(meta()); ok('cadastro válido entra', e === null, e ?? ''); }
const { rows: users } = await db.query(`select id from auth.users`);
const uid = users[0].id;
const { rows: cons } = await db.query(`select document, version from public.consents where user_id = $1 order by document`, [uid]);
ok('aceites registrados com data do servidor', cons.length === 3 && cons.map((c) => c.document).join() === 'maioridade,privacidade,termos', JSON.stringify(cons));

for (const [name, m] of [
  ['nome sem sobrenome', meta({ full_name: 'Maria' })],
  ['nome com número', meta({ full_name: 'Maria 2 Silva' })],
  ['nome com símbolo', meta({ full_name: 'Maria @ Silva' })],
  ['celular fixo', meta({ phone: '+551134567890' })],
  ['DDD inexistente', meta({ phone: '+5520987654321' })],
  ['celular sem +55', meta({ phone: '11996421873' })],
  ['sem aceite dos termos', meta({ terms_version: '' })],
  ['sem maioridade', meta({ adult: false })],
  ['sem metadados', null],
]) {
  const err = await insert(m);
  ok(`recusa ${name}`, err !== null && /baiu:/.test(err), err ?? 'aceitou');
}
for (const [name, m] of [
  ["nome com apóstrofo", meta({ full_name: "Maria D'Ávila" })],
  ['nome com hífen e acento', meta({ full_name: 'Ana-Luíza Ñúñez' })],
  ['celular do RS', meta({ phone: '+5554991234567' })],
]) {
  ok(`aceita ${name}`, (await insert(m)) === null);
}

ok('login (sem mudar dados) não é bloqueado', (await fails(`update auth.users set last_sign_in_at = now() where id = $1`, [uid])) === null);
const bad = await fails(`update auth.users set raw_user_meta_data = raw_user_meta_data || '{"phone":"123"}' where id = $1`, [uid]);
ok('edição com celular inválido é recusada', bad !== null && /celular/.test(bad), bad ?? 'aceitou');
ok(
  'edição válida passa',
  (await fails(`update auth.users set raw_user_meta_data = raw_user_meta_data || '{"full_name":"Maria Souza"}' where id = $1`, [uid])) === null,
);

// como usuário logado, pela API
await db.exec(`set role authenticated`);
await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false)`);
const ins = await fails(`insert into public.consents (user_id, document, version) values ($1, 'termos', 'falso')`, [uid]);
ok('usuário não grava aceites pela API', ins !== null && /permission denied/.test(ins), ins ?? 'gravou');
const { rows: mine } = await db.query(`select count(*)::int as n from public.consents`);
ok('usuário só vê os próprios aceites', mine[0].n === 3, JSON.stringify(mine));
const trig = await fails(`select public.baiu_record_consents()`);
ok('funções internas não são chamáveis', trig !== null, trig ?? 'chamou');

await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
const anonDel = await fails(`select public.delete_account()`);
ok('excluir sem estar logado falha', anonDel !== null, anonDel ?? 'excluiu');
await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false)`);
ok('excluir a própria conta funciona', (await fails(`select public.delete_account()`)) === null);
await db.exec(`reset role`);
const { rows: left } = await db.query(`select count(*)::int as n from auth.users where id = $1`, [uid]);
const { rows: leftC } = await db.query(`select count(*)::int as n from public.consents where user_id = $1`, [uid]);
ok('conta e aceites saem do servidor', left[0].n === 0 && leftC[0].n === 0, JSON.stringify([left, leftC]));
const { rows: others } = await db.query(`select count(*)::int as n from auth.users`);
ok('outras contas continuam', others[0].n === 3, JSON.stringify(others));

await db.exec(`set role anon`);
const anonCall = await fails(`select public.delete_account()`);
ok('visitante anônimo não pode chamar a exclusão', anonCall !== null && /permission denied/.test(anonCall), anonCall ?? 'chamou');

console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FALHA')) ? 1 : 0);
