-- "Personalizar Acesso" (Gestão de Usuários, exclusivo da conta master):
-- restringe, por usuário comum, quais ferramentas do Painel (ver
-- FERRAMENTAS em src/lib/ferramentas.jsx) aparecem pra ele e ficam
-- acessíveis por rota. Bloqueio só de interface/navegação — não mexe em
-- RLS das tabelas de cada ferramenta (ver pedido original).
--
-- NULL ou array vazio = acesso total (comportamento padrão, inclusive
-- pra todo usuário já existente hoje — ninguém perde acesso com esta
-- migration). Só passa a restringir quando a conta master desmarcar
-- alguma ferramenta explicitamente pela tela.
alter table public.perfis
  add column if not exists ferramentas_permitidas text[];

comment on column public.perfis.ferramentas_permitidas is
  'Chaves de FERRAMENTAS (src/lib/ferramentas.jsx) liberadas no Painel para este usuário. NULL/vazio = acesso total (padrão). Só é considerado para usuários não-admin — admins sempre têm acesso total a todas as ferramentas. Só a conta master pode alterar (ver trigger restringir_ferramentas_permitidas_update).';

-- Função auxiliar no mesmo padrão de is_admin()/is_approved() (migration
-- 0002): usada dentro de policy/trigger pra checar o próprio is_master sem
-- cair em recursão de RLS.
create or replace function public.is_master()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_master from public.perfis where id = auth.uid()),
    false
  )
$$;

-- A tabela perfis já tem policy "Admins podem atualizar perfis" (migration
-- 0002), que libera UPDATE de qualquer coluna pra qualquer admin — RLS é
-- por linha, não por coluna, então não dá pra restringir só esta coluna
-- por policy. Em vez disso, um trigger (mesmo padrão de
-- proteger_conta_master, migration 0009) barra a alteração específica
-- desta coluna quando quem está executando o UPDATE não é a conta master,
-- mesmo que a policy de RLS já tenha liberado o UPDATE em si.
create or replace function public.restringir_ferramentas_permitidas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.ferramentas_permitidas is distinct from OLD.ferramentas_permitidas
     and not public.is_master() then
    raise exception 'Só a conta master pode personalizar o acesso a ferramentas.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists restringir_ferramentas_permitidas_update on public.perfis;
create trigger restringir_ferramentas_permitidas_update
  before update on public.perfis
  for each row execute function public.restringir_ferramentas_permitidas();
