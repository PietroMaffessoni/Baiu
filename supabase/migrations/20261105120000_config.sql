-- Baiu: a versão dos termos e o limite do dia ficam no banco, não com quem
-- chama. Vem depois de 20261027120000_bancos_sem_assinatura.sql.
--
-- 1. A tabela baiu_config guarda a versão atual do termo da IA e do termo de
--    conexão com banco, e o limite de perguntas por dia.
-- 2. assistant_consent e bank_link só aceitam a versão atual do termo.
-- 3. assistant_take deixa de receber versão e limite: lê de baiu_config.
--    Quem chamar direto só gasta a própria cota.

-- ---------- configuração ----------

-- Uma linha só. Ninguém lê nem grava pela API.
-- As versões dos termos mudam por migração (junto com o texto no app).
-- O limite do dia pode mudar no SQL Editor:
--   update public.baiu_config set assistant_daily_limit = 50;
create table if not exists public.baiu_config (
  id boolean primary key default true check (id),
  assistant_consent_version text not null check (assistant_consent_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  assistant_daily_limit integer not null default 30 check (assistant_daily_limit between 1 and 1000),
  bank_consent_version text not null check (bank_consent_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);

alter table public.baiu_config enable row level security;
revoke all on public.baiu_config from anon, authenticated;

-- rodar de novo atualiza as versões dos termos e mantém o limite escolhido
-- (AI_CONSENT_VERSION e BANK_CONSENT_VERSION no app)
insert into public.baiu_config (id, assistant_consent_version, bank_consent_version)
  values (true, '2026-10-15', '2026-10-23')
  on conflict (id) do update
    set assistant_consent_version = excluded.assistant_consent_version,
        bank_consent_version = excluded.bank_consent_version;

-- ---------- aceite da IA ----------

-- Só aceita a versão atual do termo; revogar não pede versão.
create or replace function public.assistant_consent(granted boolean, version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  current_version text := (select c.assistant_consent_version from public.baiu_config c);
begin
  if uid is null then
    raise exception 'baiu: não autenticado' using errcode = '42501';
  end if;
  if granted and assistant_consent.version is distinct from current_version then
    raise exception 'baiu: versão do termo desatualizada' using errcode = '22023';
  end if;
  -- um aceite novo encerra o anterior; revogar encerra todos
  update public.consents c set revoked_at = now()
    where c.user_id = uid and c.document = 'assistente' and c.revoked_at is null;
  if granted then
    insert into public.consents (user_id, document, version) values (uid, 'assistente', current_version);
  end if;
end;
$$;

revoke all on function public.assistant_consent(boolean, text) from public, anon;
grant execute on function public.assistant_consent(boolean, text) to authenticated;

-- ---------- limite diário ----------

-- versão anterior, que recebia versão e limite de quem chamava
drop function if exists public.assistant_take(text, integer);

-- Chamada pela função baiu-chat com o login da pessoa, antes de cada pergunta.
-- Confere o consentimento ativo na versão atual e conta mais uma pergunta,
-- se ainda couber no dia (horário de Brasília).
create or replace function public.assistant_take()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  cfg public.baiu_config;
  used integer;
begin
  if uid is null then
    return json_build_object('ok', false, 'reason', 'session');
  end if;
  select * into cfg from public.baiu_config;
  if not exists (
    select 1 from public.consents c
    where c.user_id = uid and c.document = 'assistente'
      and c.version = cfg.assistant_consent_version and c.revoked_at is null
  ) then
    return json_build_object('ok', false, 'reason', 'consent');
  end if;

  delete from public.assistant_usage a where a.user_id = uid and a.day < today - 30;

  insert into public.assistant_usage as u (user_id, day, count) values (uid, today, 1)
    on conflict (user_id, day) do update set count = u.count + 1
    where u.count < cfg.assistant_daily_limit
    returning u.count into used;

  if used is null then
    return json_build_object('ok', false, 'reason', 'quota');
  end if;
  return json_build_object('ok', true, 'remaining', greatest(cfg.assistant_daily_limit - used, 0));
end;
$$;

revoke all on function public.assistant_take() from public, anon;
grant execute on function public.assistant_take() to authenticated;

-- ---------- conexão com banco ----------

-- Igual à de 20261023120000_polp.sql, mas só aceita a versão atual do termo
-- de conexão: os aceites antigos não valem para conexões novas.
create or replace function public.bank_link(item_id text, institution text, version text, products text[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'baiu: não autenticado' using errcode = '42501';
  end if;
  if bank_link.version is distinct from (select c.bank_consent_version from public.baiu_config c) then
    raise exception 'baiu: versão do termo desatualizada' using errcode = '22023';
  end if;
  insert into public.bank_connections as b (user_id, item_id, institution, products)
    values (uid, bank_link.item_id, left(coalesce(bank_link.institution, ''), 120), coalesce(bank_link.products, '{}'))
    on conflict on constraint bank_connections_pkey do update
      set institution = excluded.institution, products = excluded.products, revoked_at = null;
  if not exists (
    select 1 from public.consents c
    where c.user_id = uid and c.document = 'conexao_bancaria' and c.reference = bank_link.item_id and c.revoked_at is null
  ) then
    insert into public.consents (user_id, document, version, reference)
      values (uid, 'conexao_bancaria', bank_link.version, bank_link.item_id);
  end if;
end;
$$;

revoke all on function public.bank_link(text, text, text, text[]) from public, anon;
grant execute on function public.bank_link(text, text, text, text[]) to authenticated;
