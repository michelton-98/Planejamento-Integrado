-- Coluna is_master: marca a conta "dona" do sistema, protegida contra
-- rebaixamento/exclusão mesmo por outros administradores. Só a linha da
-- michel.ribeiro@inpasa.com.br é marcada (ver UPDATE no fim deste arquivo).
alter table public.perfis
  add column if not exists is_master boolean not null default false;

-- Trigger (não RLS): a proteção precisa valer para QUALQUER UPDATE/DELETE
-- na tabela, inclusive chamadas diretas à API com uma sessão de admin —
-- não só esconder o botão na interface. Duas regras:
--   1) uma conta com is_master = true nunca pode ter is_admin definido
--      como false;
--   2) uma conta com is_master = true nunca pode ser excluída.
-- A checagem usa sempre o valor ANTIGO da linha (OLD.is_master), então o
-- UPDATE deste próprio arquivo (que liga is_master pela primeira vez) não
-- é bloqueado por ela.
create or replace function public.proteger_conta_master()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.is_master then
      raise exception 'Contas master não podem ser excluídas.';
    end if;
    return OLD;
  end if;

  if OLD.is_master and NEW.is_admin = false then
    raise exception 'Contas master não podem ter o acesso de administrador removido.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists proteger_conta_master_update on public.perfis;
create trigger proteger_conta_master_update
  before update on public.perfis
  for each row execute function public.proteger_conta_master();

drop trigger if exists proteger_conta_master_delete on public.perfis;
create trigger proteger_conta_master_delete
  before delete on public.perfis
  for each row execute function public.proteger_conta_master();

-- Marca a conta master. Feito aqui (migration), não pela interface: é a
-- única forma prevista de ligar is_master.
update public.perfis
set is_master = true,
    is_admin = true
where email = 'michel.ribeiro@inpasa.com.br';
