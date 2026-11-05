-- Baiu: conversa com o assistente (IA).
--
-- 1. O consentimento para a conversa com IA fica registrado na tabela de
--    aceites, com data do servidor, e pode ser revogado (LGPD, art. 8º, §5º).
-- 2. Um contador diário por pessoa limita o uso da IA. Guarda só a data e a
--    quantidade de perguntas; o conteúdo das conversas não é guardado.
-- 3. A versão do termo e o limite do dia ficam no banco, não com quem chama.

-- ---------- configuração ----------

-- Uma linha só. Ninguém lê nem grava pela API.
-- A versão do termo muda por migração (junto com o texto no app).
-- O limite do dia pode mudar no SQL Editor:
--   update public.baiu_config set assistant_daily_limit = 50;
create table if not exists public.baiu_config (
  id boolean primary key default true check (id),
  assistant_consent_version text not null check (assistant_consent_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  assistant_daily_limit integer not null default 30 check (assistant_daily_limit between 1 and 1000)
);

alter table public.baiu_config enable row level security;
revoke all on public.baiu_config from anon, authenticated;

-- rodar de novo atualiza a versão do termo e mantém o limite escolhido
insert into public.baiu_config (id, assistant_consent_version) values (true, '2026-10-15')
  on conflict (id) do update set assistant_consent_version = excluded.assistant_consent_version;

-- ---------- aceite da IA ----------

alter table public.consents drop constraint if exists consents_document_check;
alter table public.consents add constraint consents_document_check
  check (document in ('termos', 'privacidade', 'maioridade', 'assistente'));

alter table public.consents add column if not exists revoked_at timestamptz;

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

create table if not exists public.assistant_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);

alter table public.assistant_usage enable row level security;
-- ninguém lê nem grava pela API: só a função abaixo
revoke all on public.assistant_usage from anon, authenticated;

-- versão anterior, que recebia versão e limite de quem chamava
drop function if exists public.assistant_take(text, integer);

-- Chamada pela função baiu-chat com o login da pessoa, antes de cada pergunta.
-- Confere o consentimento ativo na versão atual e conta mais uma pergunta,
-- se ainda couber no dia (horário de Brasília). Quem chamar direto só gasta
-- a própria cota.
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
