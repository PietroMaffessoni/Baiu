-- Baiu: aceite de novo quando os textos mudam, e prazo dos registros de acesso.
--
-- 1. Quando os Termos de uso ou a Política de privacidade mudam, o app pede o
--    aceite de novo e grava a versão nova nos dados da conta. Este gatilho
--    registra cada aceite novo em consents, com a data do servidor, como o
--    cadastro já faz.
-- 2. Os registros de acesso do login (data, hora e IP, em
--    auth.audit_log_entries) ficam 6 meses e depois são apagados, como diz a
--    política de privacidade. Com o pg_cron ligado, a limpeza roda todo dia.

-- ---------- aceite de versões novas ----------

create or replace function public.baiu_record_new_consents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  o jsonb := coalesce(old.raw_user_meta_data, '{}'::jsonb);
begin
  if coalesce(m ->> 'terms_version', '') <> '' and m ->> 'terms_version' is distinct from o ->> 'terms_version' then
    insert into public.consents (user_id, document, version) values (new.id, 'termos', m ->> 'terms_version');
  end if;
  if coalesce(m ->> 'privacy_version', '') <> '' and m ->> 'privacy_version' is distinct from o ->> 'privacy_version' then
    insert into public.consents (user_id, document, version) values (new.id, 'privacidade', m ->> 'privacy_version');
  end if;
  return new;
end;
$$;

drop trigger if exists baiu_record_new_consents on auth.users;
create trigger baiu_record_new_consents
  after update of raw_user_meta_data on auth.users
  for each row execute function public.baiu_record_new_consents();

revoke all on function public.baiu_record_new_consents() from public, anon, authenticated;

-- ---------- registros de acesso: 6 meses ----------

create or replace function public.baiu_cleanup_access_logs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer := 0;
begin
  if to_regclass('auth.audit_log_entries') is null then
    return 0;
  end if;
  delete from auth.audit_log_entries where created_at < now() - interval '6 months';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.baiu_cleanup_access_logs() from public, anon, authenticated;
grant execute on function public.baiu_cleanup_access_logs() to service_role;

-- todo dia às 3h30 de Brasília (6h30 UTC). Sem o pg_cron, agende depois (LEIA-ME, passo 7.2).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('baiu-registros-de-acesso', '30 6 * * *', 'select public.baiu_cleanup_access_logs()');
  end if;
end;
$$;
