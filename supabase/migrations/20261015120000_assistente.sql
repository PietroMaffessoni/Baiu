-- Baiu: conversa com o assistente (IA).
--
-- 1. O consentimento para a conversa com IA fica registrado na tabela de
--    aceites, com data do servidor, e pode ser revogado (LGPD, art. 8º, §5º).
-- 2. Um contador diário por pessoa limita o uso da IA. Guarda só a data e a
--    quantidade de perguntas; o conteúdo das conversas não é guardado.

-- ---------- aceite da IA ----------

alter table public.consents drop constraint if exists consents_document_check;
alter table public.consents add constraint consents_document_check
  check (document in ('termos', 'privacidade', 'maioridade', 'assistente'));

alter table public.consents add column if not exists revoked_at timestamptz;

create or replace function public.assistant_consent(granted boolean, version text)
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
  -- um aceite novo encerra o anterior; revogar encerra todos
  update public.consents c set revoked_at = now()
    where c.user_id = uid and c.document = 'assistente' and c.revoked_at is null;
  if granted then
    if assistant_consent.version is null or assistant_consent.version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'baiu: versão inválida' using errcode = '22023';
    end if;
    insert into public.consents (user_id, document, version) values (uid, 'assistente', assistant_consent.version);
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

-- Chamada pela função baiu-chat com o login da pessoa, antes de cada pergunta.
-- Confere o consentimento ativo na versão atual e conta mais uma pergunta,
-- se ainda couber no dia (horário de Brasília).
create or replace function public.assistant_take(version text, daily_limit integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  used integer;
begin
  if uid is null then
    return json_build_object('ok', false, 'reason', 'session');
  end if;
  if not exists (
    select 1 from public.consents c
    where c.user_id = uid and c.document = 'assistente' and c.version = assistant_take.version and c.revoked_at is null
  ) then
    return json_build_object('ok', false, 'reason', 'consent');
  end if;

  delete from public.assistant_usage a where a.user_id = uid and a.day < today - 30;

  insert into public.assistant_usage as u (user_id, day, count) values (uid, today, 1)
    on conflict (user_id, day) do update set count = u.count + 1
    where u.count < greatest(daily_limit, 1)
    returning u.count into used;

  if used is null then
    return json_build_object('ok', false, 'reason', 'quota');
  end if;
  return json_build_object('ok', true, 'remaining', greatest(daily_limit, 1) - used);
end;
$$;

revoke all on function public.assistant_take(text, integer) from public, anon;
grant execute on function public.assistant_take(text, integer) to authenticated;
