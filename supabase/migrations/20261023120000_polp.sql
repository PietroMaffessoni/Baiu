-- Baiu: conexão de contas pela Polp (Open Finance, com a Celcoin como
-- instituição regulada). Vem depois de 20261015130000_bancos.sql.
--
-- O Open Finance exige que a pessoa veja todas as autorizações que já deu,
-- inclusive as canceladas. Por isso desconectar deixa de apagar a conexão:
-- marca a data do cancelamento. Saldos e movimentos continuam fora daqui.

alter table public.bank_connections add column if not exists revoked_at timestamptz;

-- categorias de dados pedidas na autorização (products da Polp)
alter table public.bank_connections add column if not exists products text[] not null default '{}';
alter table public.bank_connections drop constraint if exists bank_connections_products_check;
alter table public.bank_connections add constraint bank_connections_products_check
  check (products <@ array['ACCOUNT', 'CREDIT_CARD_ACCOUNT', 'CREDIT_OPERATIONS', 'INVESTMENTS', 'EXCHANGE']::text[]);

-- Registra a autorização no momento em que a pessoa confirma, antes de ir
-- ao banco: a lista de autorizações mostra também as pendentes e recusadas.
-- Reconectar a mesma autorização reativa a linha.
drop function if exists public.bank_link(text, text, text);
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
  if bank_link.version is null or bank_link.version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'baiu: versão inválida' using errcode = '22023';
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

-- Cancela a autorização: a conexão fica no histórico com a data.
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
  update public.bank_connections b set revoked_at = now()
    where b.user_id = uid and b.item_id = bank_unlink.item_id and b.revoked_at is null;
  update public.consents c set revoked_at = now()
    where c.user_id = uid and c.document = 'conexao_bancaria' and c.reference = bank_unlink.item_id
      and c.revoked_at is null;
end;
$$;

revoke all on function public.bank_link(text, text, text, text[]) from public, anon;
revoke all on function public.bank_unlink(text) from public, anon;
grant execute on function public.bank_link(text, text, text, text[]) to authenticated;
grant execute on function public.bank_unlink(text) to authenticated;
