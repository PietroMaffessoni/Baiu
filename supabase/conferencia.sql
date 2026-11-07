-- Conferência do banco de dados do Baiu.
--
-- Cole tudo no SQL Editor do Supabase e clique em Run. Só lê; não muda nada.
-- Cada linha é um item: ✅ está certo, ❌ precisa de ajuste (a coluna
-- "o_que_fazer" diz como), ⚠️ é um aviso. Nenhum segredo aparece no resultado.

with
fn(sig, quem) as (
  values
    ('public.delete_account()', 'app'),
    ('public.assistant_consent(boolean, text)', 'app'),
    ('public.assistant_take()', 'app'),
    ('public.bank_link(text, text, text, text[])', 'app'),
    ('public.bank_unlink(text)', 'app'),
    ('public.bank_active_connections()', 'servidor'),
    ('public.bank_lapse(uuid, text)', 'servidor'),
    ('public.baiu_cleanup_access_logs()', 'servidor')
),
tb(nome, app_le) as (
  values ('consents', true), ('assistant_usage', false), ('bank_connections', true), ('baiu_config', false)
),
itens(ordem, item, ok, o_que_fazer) as (
  -- 1. tabelas
  select 10, 'Tabela ' || nome || ' existe', to_regclass('public.' || nome) is not null,
         'Rode as migrações de supabase/migrations, na ordem da data (LEIA-ME, passo 2).'
  from tb
  union all
  select 11, 'Tabela ' || nome || ' com RLS ligado',
         coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.' || nome)), false),
         'Rode a migração que cria a tabela de novo; ela liga o RLS.'
  from tb
  union all
  select 12, 'Tabela ' || nome || ': pessoa logada só lê' || case when app_le then ' as próprias linhas' else ' nada' end,
         coalesce(
           has_table_privilege('authenticated', to_regclass('public.' || nome), 'select') = app_le
           and not has_table_privilege('authenticated', to_regclass('public.' || nome), 'insert, update, delete')
           and (not app_le or exists (select 1 from pg_policies where schemaname = 'public' and tablename = nome)),
           false),
         'Rode de novo a migração que cria a tabela: ela acerta permissões e a regra "dono lê".'
  from tb
  union all
  select 13, 'Tabela ' || nome || ': sem acesso para quem não entrou',
         coalesce(not has_table_privilege('anon', to_regclass('public.' || nome), 'select, insert, update, delete'), false),
         'Rode de novo a migração que cria a tabela (ela faz revoke all de anon).'
  from tb
  union all
  select 14, 'bank_connections tem as colunas da Polp (revoked_at, products)',
         (select count(*) = 2 from information_schema.columns
          where table_schema = 'public' and table_name = 'bank_connections' and column_name in ('revoked_at', 'products')),
         'Rode a migração 20261023120000_polp.sql.'
  union all
  select 15, 'consents tem a coluna revoked_at',
         exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'consents' and column_name = 'revoked_at'),
         'Rode a migração 20261015120000_assistente.sql.'
  union all
  select 16, 'baiu_config tem as versões dos termos (IA e bancos)',
         coalesce(case when exists (select 1 from information_schema.columns
                                    where table_schema = 'public' and table_name = 'baiu_config' and column_name = 'bank_consent_version') then
           (xpath('/row/n/text()', query_to_xml($q$select count(*) as n from public.baiu_config
             where assistant_consent_version is not null and bank_consent_version is not null$q$, false, true, '')))[1]::text::int = 1
         end, false),
         'Rode a migração 20261105120000_config.sql.'

  -- 2. funções do banco
  union all
  select 20, 'Função ' || sig || ' existe', to_regprocedure(sig) is not null,
         'Rode as migrações que faltam, na ordem da data.'
  from fn
  union all
  select 21, 'Função ' || sig || ': ' || case when quem = 'app' then 'só pessoa logada chama' else 'só o servidor chama' end,
         coalesce(
           not has_function_privilege('anon', to_regprocedure(sig), 'execute')
           and has_function_privilege('authenticated', to_regprocedure(sig), 'execute') = (quem = 'app')
           and (quem = 'app' or has_function_privilege('service_role', to_regprocedure(sig), 'execute')),
           false),
         'Rode de novo a migração da função: o fim do arquivo acerta quem pode chamar.'
  from fn
  union all
  select 22, 'A versão antiga de bank_link (3 campos) foi apagada',
         to_regprocedure('public.bank_link(text, text, text)') is null,
         'Rode a migração 20261023120000_polp.sql.'
  union all
  select 22, 'A versão antiga de assistant_take (versão e limite vindos de quem chama) foi apagada',
         to_regprocedure('public.assistant_take(text, integer)') is null,
         'Rode a migração 20261105120000_config.sql.'

  union all
  -- funções criadas à mão no painel: ninguém revisou quem pode chamar
  select 23, 'Função public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') não vem das migrações do Baiu', false,
         'Pergunte a quem criou. Se ninguém usa, apague: drop function public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ');'
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    -- gatilhos de eventos, como o rls_auto_enable do RLS automático do Supabase
    and p.oid not in (select evtfoid from pg_event_trigger)
    and p.oid not in (
      select to_regprocedure(sig) from fn where to_regprocedure(sig) is not null
      union all
      select to_regprocedure(x) from unnest(array[
        'public.baiu_valid_name(text)', 'public.baiu_valid_phone(text)', 'public.baiu_check_user()',
        'public.baiu_record_consents()', 'public.baiu_record_new_consents()', 'public.bank_link(text, text, text)',
        'public.assistant_take(text, integer)']) x
      where to_regprocedure(x) is not null)

  -- 3. gatilhos do cadastro
  union all
  select 30, 'Gatilho ' || t || ' na tabela de usuários',
         exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = t and not tgisinternal),
         case when t = 'baiu_record_new_consents' then 'Rode a migração 20261106120000_aceites_e_registros.sql.'
              else 'Rode a migração 20261014120000_contas.sql.' end
  from unnest(array['baiu_check_user', 'baiu_record_consents', 'baiu_record_new_consents']) t

  -- 4. tarefa diária (LEIA-ME, passo 7.1)
  union all
  select 40, 'Extensão ' || e || ' ligada',
         exists (select 1 from pg_extension where extname = e),
         'Database, Extensions: ligue ' || e || '.'
  from unnest(array['pg_cron', 'pg_net']) e
  union all
  select 41, 'Segredo ' || s || ' guardado no Vault',
         coalesce(case when to_regclass('vault.secrets') is not null then
           (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from vault.secrets where name = %L', s), false, true, '')))[1]::text::int > 0
         end, false),
         'SQL Editor: select vault.create_secret(...) do LEIA-ME, passo 7.1.'
  from unnest(array['project_url', 'bank_cleanup_secret']) s
  union all
  select 42, 'project_url no Vault é o endereço do projeto (https://....supabase.co)',
         coalesce(case when to_regclass('vault.decrypted_secrets') is not null then
           (xpath('/row/n/text()', query_to_xml($q$select count(*) as n from vault.decrypted_secrets
             where name = 'project_url' and decrypted_secret ~ '^https://[a-z0-9]+\.supabase\.co$'$q$, false, true, '')))[1]::text::int > 0
         end, false),
         'Apague e crie de novo: select vault.delete_secret... ou, no painel, Project Settings, Vault. Sem barra no final.'
  union all
  select 43, 'Tarefa diária baiu-bancos-sem-assinatura agendada',
         coalesce(case when to_regclass('cron.job') is not null then
           (xpath('/row/n/text()', query_to_xml($q$select count(*) as n from cron.job
             where jobname = 'baiu-bancos-sem-assinatura' and active and command like '%/functions/v1/bank%'$q$, false, true, '')))[1]::text::int > 0
         end, false),
         'SQL Editor: rode o select cron.schedule(...) do LEIA-ME, passo 7.1.'

  -- 5. registros de acesso: 6 meses (LEIA-ME, passo 7.2)
  union all
  select 44, 'Tarefa diária baiu-registros-de-acesso agendada',
         coalesce(case when to_regclass('cron.job') is not null then
           (xpath('/row/n/text()', query_to_xml($q$select count(*) as n from cron.job
             where jobname = 'baiu-registros-de-acesso' and active and command like '%baiu_cleanup_access_logs%'$q$, false, true, '')))[1]::text::int > 0
         end, false),
         'SQL Editor: rode o select cron.schedule(''baiu-registros-de-acesso'', ...) do LEIA-ME, passo 7.2.'
  union all
  select 45, 'A limpeza dos registros de acesso consegue apagar em auth.audit_log_entries',
         to_regclass('auth.audit_log_entries') is null
           or coalesce(has_table_privilege(
                (select p.proowner::regrole::text from pg_proc p where p.oid = to_regprocedure('public.baiu_cleanup_access_logs()')),
                'auth.audit_log_entries', 'delete'), false),
         'Rode a migração 20261106120000_aceites_e_registros.sql pelo GitHub ou no SQL Editor, como postgres. Se continuar ❌, fale com o suporte do Supabase.'
)
select ordem, item,
       case when ok then '✅' else '❌' end as ok,
       case when ok then '' else o_que_fazer end as o_que_fazer
from itens

-- avisos: não bloqueiam, mas ajudam a entender
union all
select 50, 'Histórico de migrações (' || coalesce(
         case when to_regclass('supabase_migrations.schema_migrations') is not null then
           (xpath('/row/n/text()', query_to_xml($q$select count(*) as n from supabase_migrations.schema_migrations
             where version in ('20261014120000', '20261015120000', '20261015130000', '20261023120000', '20261027120000', '20261105120000', '20261106120000')$q$,
             false, true, '')))[1]::text
         end, '0') || ' de 7 registradas)',
       '⚠️',
       'Só informativo: migrações coladas à mão no SQL Editor não entram nesse histórico. Valem os itens acima.'
union all
select 51, 'Última execução da tarefa diária: ' || coalesce(
         case when to_regclass('cron.job_run_details') is not null then
           (xpath('/row/s/text()', nullif(query_to_xml($q$select d.status || ' em ' || to_char(d.start_time at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as s
             from cron.job_run_details d join cron.job j using (jobid)
             where j.jobname = 'baiu-bancos-sem-assinatura' order by d.start_time desc limit 1$q$, false, true, '')::text, '')::xml))[1]::text
         end, 'ainda não rodou'),
       '⚠️',
       'Roda todo dia às 3h (Brasília). Depois, confira no log da função bank a linha "bank: limpeza".'
order by ordem, item;
