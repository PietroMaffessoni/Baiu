-- Baiu: cancelar as autorizações dos bancos de quem ficou sem assinatura.
-- Vem depois de 20261023120000_polp.sql.
--
-- Cada banco conectado custa uma mensalidade na Polp enquanto a autorização
-- estiver ativa. Uma tarefa diária (pg_cron chamando a função `bank`, veja o
-- LEIA-ME) confere no RevenueCat quem saiu da assinatura e, passado o prazo,
-- cancela na Polp e marca aqui. Estas duas funções só podem ser chamadas com
-- a chave secreta do Supabase (papel service_role), nunca pelo app.

-- Todas as conexões ativas, de todas as pessoas.
create or replace function public.bank_active_connections()
returns table (user_id uuid, item_id text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.user_id, b.item_id, b.created_at
  from public.bank_connections b
  where b.revoked_at is null
  order by b.user_id, b.created_at;
$$;

-- Encerra uma conexão de uma pessoa (e o aceite dela). A linha fica no histórico.
create or replace function public.bank_lapse(p_user uuid, p_item text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bank_connections b set revoked_at = now()
    where b.user_id = p_user and b.item_id = p_item and b.revoked_at is null;
  update public.consents c set revoked_at = now()
    where c.user_id = p_user and c.document = 'conexao_bancaria' and c.reference = p_item and c.revoked_at is null;
end;
$$;

revoke all on function public.bank_active_connections() from public, anon, authenticated;
revoke all on function public.bank_lapse(uuid, text) from public, anon, authenticated;
grant execute on function public.bank_active_connections() to service_role;
grant execute on function public.bank_lapse(uuid, text) to service_role;
