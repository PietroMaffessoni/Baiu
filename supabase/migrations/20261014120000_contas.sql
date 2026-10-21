-- Baiu: contas de usuário.
-- Rodar uma vez no SQL Editor do Supabase (ou com `supabase db push`).
--
-- 1. Confere de novo, no servidor, as regras do cadastro (nome, celular,
--    aceites). Quem chamar a API direto, sem o app, não escapa delas.
-- 2. Registra os aceites da LGPD com data do servidor, em tabela própria.
-- 3. Permite que a própria pessoa exclua a conta pelo app.

-- ---------- aceites ----------

create table if not exists public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  document text not null check (document in ('termos', 'privacidade', 'maioridade')),
  version text not null,
  accepted_at timestamptz not null default now()
);

create index if not exists consents_user_id_idx on public.consents (user_id);

alter table public.consents enable row level security;

drop policy if exists "consents: dono lê" on public.consents;
create policy "consents: dono lê" on public.consents
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- permissões explícitas: o projeto não expõe tabelas novas automaticamente.
-- A pessoa logada só lê os próprios aceites; ninguém grava pela API, só o
-- gatilho abaixo, com a data do servidor.
revoke all on public.consents from anon, authenticated;
grant select on public.consents to authenticated;

-- ---------- validação ----------

create or replace function public.baiu_valid_name(n text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select n is not null
    and char_length(btrim(n)) between 3 and 80
    and btrim(n) ~ '^[^[:space:]]+([[:space:]]+[^[:space:]]+)+$'
    and n !~ '[0-9]'
    and n !~ '[!-&(-,./:-@\[-`{-~]';
$$;

create or replace function public.baiu_valid_phone(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- celular brasileiro em E.164: +55, DDD em uso e 9 dígitos começando com 9
  select p is not null
    and p ~ '^\+55(1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[134579]|8[1-9]|9[1-9])9[0-9]{8}$';
$$;

create or replace function public.baiu_check_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  -- só confere quando os dados da pessoa mudam; logins e renovações passam direto
  if tg_op = 'UPDATE' and new.raw_user_meta_data is not distinct from old.raw_user_meta_data then
    return new;
  end if;

  if not public.baiu_valid_name(m ->> 'full_name') then
    raise exception 'baiu: nome inválido' using errcode = '22023';
  end if;
  if not public.baiu_valid_phone(m ->> 'phone') then
    raise exception 'baiu: celular inválido' using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    if coalesce(m ->> 'terms_version', '') = ''
      or coalesce(m ->> 'privacy_version', '') = ''
      or coalesce(m ->> 'adult', '') <> 'true' then
      raise exception 'baiu: aceites ausentes' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists baiu_check_user on auth.users;
create trigger baiu_check_user
  before insert or update on auth.users
  for each row execute function public.baiu_check_user();

-- ---------- registro dos aceites ----------

create or replace function public.baiu_record_consents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.consents (user_id, document, version) values
    (new.id, 'termos', m ->> 'terms_version'),
    (new.id, 'privacidade', m ->> 'privacy_version'),
    (new.id, 'maioridade', 'declarada');
  return new;
end;
$$;

drop trigger if exists baiu_record_consents on auth.users;
create trigger baiu_record_consents
  after insert on auth.users
  for each row execute function public.baiu_record_consents();

-- ---------- exclusão da conta (LGPD, art. 18, VI) ----------

create or replace function public.delete_account()
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
  -- os aceites saem junto (on delete cascade)
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

revoke all on function public.baiu_check_user() from public, anon, authenticated;
revoke all on function public.baiu_record_consents() from public, anon, authenticated;
