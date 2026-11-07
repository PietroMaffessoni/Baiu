import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

// Testa a consulta de conferência (supabase/conferencia.sql) num Postgres
// embutido: banco vazio, banco certo, banco com erros e a tarefa diária.
// Rodar: npm run test:sql
const read = (f) => fs.readFileSync(new URL(`../supabase/${f}`, import.meta.url), 'utf8');
const db = new PGlite();
const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'OK   ' : 'FALHA'} ${name}${cond ? '' : ' ' + extra}`);
const check = async () => (await db.query(read('conferencia.sql'))).rows;
const bad = (rows, from, to) => rows.filter((r) => r.ordem >= from && r.ordem <= to && r.ok === '❌').map((r) => r.item);

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);

let rows = await check();
ok('banco vazio: tabelas, funções e gatilhos aparecem como faltando', bad(rows, 10, 30).length === 38, bad(rows, 10, 30).length);
ok('itens com ❌ dizem o que fazer', rows.every((r) => r.ok !== '❌' || r.o_que_fazer.length > 10));

for (const f of [
  '20261014120000_contas.sql',
  '20261015120000_assistente.sql',
  '20261015130000_bancos.sql',
  '20261023120000_polp.sql',
  '20261027120000_bancos_sem_assinatura.sql',
  '20261105120000_config.sql',
  '20261106120000_aceites_e_registros.sql',
])
  await db.exec(read(`migrations/${f}`));
rows = await check();
ok('com as sete migrações, tudo do banco está certo', bad(rows, 10, 30).length === 0, bad(rows, 10, 30).join('; '));
ok('sem funções estranhas depois das migrações', bad(rows, 23, 23).length === 0, bad(rows, 23, 23).join('; '));
await db.exec(`create function public.assistant_take(n integer) returns int language sql as 'select 1';`);
rows = await check();
ok('acha função criada à mão com o mesmo nome', bad(rows, 23, 23).length === 1 && rows.some((r) => r.o_que_fazer.includes('drop function public.assistant_take(n integer);')), bad(rows, 23, 23).join('; '));
await db.exec(`drop function public.assistant_take(integer);`);
await db.exec(`
  create function public.rls_auto_enable() returns event_trigger language plpgsql as 'begin end';
  create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE') execute function public.rls_auto_enable();
`);
rows = await check();
ok('a função do RLS automático do Supabase não é acusada', bad(rows, 23, 23).length === 0, bad(rows, 23, 23).join('; '));
ok('sem pg_cron e Vault, a tarefa diária aparece como faltando', bad(rows, 40, 43).length === 6, bad(rows, 40, 43).length);
ok('sem pg_cron, a limpeza dos registros de acesso aparece como faltando', bad(rows, 44, 44).length === 1);
ok('sem a tabela de registros do Supabase, a permissão não é acusada', bad(rows, 45, 45).length === 0);

await db.exec(`
  grant insert on public.consents to authenticated;
  grant execute on function public.bank_lapse(uuid, text) to authenticated;
  alter table public.assistant_usage disable row level security;
  create function public.bank_link(a text, b text, c text) returns void language sql as '';
  create function public.assistant_take(v text, l integer) returns json language sql as 'select null::json';
`);
rows = await check();
const wrong = bad(rows, 10, 30);
ok('acha permissão de gravar a mais', wrong.some((i) => i.includes('consents: pessoa logada')));
ok('acha função do servidor aberta ao app', wrong.some((i) => i.includes('bank_lapse(uuid, text): só o servidor')));
ok('acha RLS desligado', wrong.some((i) => i.includes('assistant_usage com RLS')));
ok('acha a versão antiga de bank_link', wrong.some((i) => i.includes('versão antiga de bank_link')));
ok('acha a versão antiga de assistant_take', wrong.some((i) => i.includes('versão antiga de assistant_take')));
ok('não acusa o que está certo', wrong.length === 5, wrong.join('; '));

await db.exec(`
  create schema vault; create table vault.secrets (name text, value text);
  create view vault.decrypted_secrets as select name, value as decrypted_secret from vault.secrets;
  insert into vault.secrets values ('project_url', 'https://abcdefghij.supabase.co/'), ('bank_cleanup_secret', 'x');
  create schema cron; create table cron.job (jobid int, jobname text, active bool, command text);
  create table cron.job_run_details (jobid int, status text, start_time timestamptz);
`);
rows = await check();
ok('segredos do Vault encontrados', bad(rows, 41, 41).length === 0);
ok('endereço com barra no final é recusado', bad(rows, 42, 42).length === 1);
ok('tarefa não agendada é acusada', bad(rows, 43, 43).length === 1);
await db.exec(`
  update vault.secrets set value = 'https://abcdefghij.supabase.co' where name = 'project_url';
  insert into cron.job values (1, 'baiu-bancos-sem-assinatura', true, 'select net.http_post(url := u || ''/functions/v1/bank'')');
  insert into cron.job_run_details values (1, 'succeeded', '2026-11-02 06:00:00+00');
  insert into cron.job values (2, 'baiu-registros-de-acesso', true, 'select public.baiu_cleanup_access_logs()');
`);
rows = await check();
ok('Vault e tarefa certos', bad(rows, 41, 43).length === 0, bad(rows, 41, 43).join('; '));
ok('limpeza dos registros de acesso agendada', bad(rows, 44, 44).length === 0);
await db.exec(`
  create table auth.audit_log_entries (id uuid, created_at timestamptz);
  create role sem_permissao nologin;
  alter function public.baiu_cleanup_access_logs() owner to sem_permissao;
`);
rows = await check();
ok('acha a limpeza sem permissão de apagar os registros', bad(rows, 45, 45).length === 1);
ok('mostra a última execução no horário de Brasília', rows.some((r) => r.item.includes('succeeded em 02/11 03:00')));
ok('nenhum segredo aparece no resultado', !JSON.stringify(rows).includes('abcdefghij'));

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FALHA')).length;
console.log(`\n${results.length - failed} de ${results.length} conferências da consulta certas.`);
if (failed) process.exit(1);
