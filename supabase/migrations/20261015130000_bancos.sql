-- Baiu: conexão de contas pelo Open Finance (provedor Pluggy).
--
-- O servidor guarda só QUAIS conexões são de quem (o identificador da
-- conexão no provedor e o nome da instituição), mais o registro da
-- autorização. Saldos e movimentos não ficam aqui: passam pela função
-- `bank` direto para o aparelho, onde ficam cifrados.

-- ---------- aceite da conexão ----------

alter table public.consents drop constraint if exists consents_document_check;
alter table public.consents add constraint consents_document_check
  check (document in ('termos', 'privacidade', 'maioridade', 'assistente', 'conexao_bancaria'));

-- a qual conexão o aceite se refere (uma autorização por banco)
alter table public.consents add column if not exists reference text;

-- versão atual do termo de conexão; muda por migração, junto com o texto no app
alter table public.baiu_config add column if not exists bank_consent_version text
  check (bank_consent_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
update public.baiu_config set bank_consent_version = '2026-10-15';

-- ---------- conexões ----------

create table if not exists public.bank_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 100),
  institution text not null default '' check (char_length(institution) <= 120),
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.bank_connections enable row level security;

drop policy if exists "bank_connections: dono lê" on public.bank_connections;
create policy "bank_connections: dono lê" on public.bank_connections
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.bank_connections from anon, authenticated;
grant select on public.bank_connections to authenticated;

-- Liga uma conexão à pessoa e registra a autorização. Chamada pela função
-- `bank` depois de conferir no provedor que a conexão foi criada para ela.
-- Mesmo que alguém chame direto com o identificador de outra pessoa, a
-- função `bank` confere o dono no provedor antes de qualquer leitura.
create or replace function public.bank_link(item_id text, institution text, version text)
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
  insert into public.bank_connections as b (user_id, item_id, institution)
    values (uid, bank_link.item_id, left(coalesce(bank_link.institution, ''), 120))
    on conflict on constraint bank_connections_pkey do update set institution = excluded.institution;
  if not exists (
    select 1 from public.consents c
    where c.user_id = uid and c.document = 'conexao_bancaria' and c.reference = bank_link.item_id and c.revoked_at is null
  ) then
    insert into public.consents (user_id, document, version, reference)
      values (uid, 'conexao_bancaria', bank_link.version, bank_link.item_id);
  end if;
end;
$$;

-- Desliga a conexão e encerra a autorização (o histórico do aceite fica).
create or replace function public.bank_unlink(item_id text)
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
  delete from public.bank_connections b where b.user_id = uid and b.item_id = bank_unlink.item_id;
  update public.consents c set revoked_at = now()
    where c.user_id = uid and c.document = 'conexao_bancaria' and c.reference = bank_unlink.item_id
      and c.revoked_at is null;
end;
$$;

revoke all on function public.bank_link(text, text, text) from public, anon;
revoke all on function public.bank_unlink(text) from public, anon;
grant execute on function public.bank_link(text, text, text) to authenticated;
grant execute on function public.bank_unlink(text) to authenticated;
