-- "Acesso à aba Importar RDOs": libera a aba /input (importação do
-- relatório diário + cadastro "Escopos - Rondonópolis") para um usuário
-- comum específico, sem torná-lo administrador. Mecanismo independente de
-- ferramentas_permitidas (migration 0014) — vive dentro do mesmo painel
-- "Personalizar Acesso" na tela Gestão de Usuários, mas com padrão
-- invertido: aqui o padrão é RESTRITO (false), igual ao comportamento já
-- existente hoje (só admin acessa /input), diferente do "acesso total por
-- padrão" de ferramentas_permitidas.
alter table public.perfis
  add column if not exists pode_importar_rdos boolean not null default false;

comment on column public.perfis.pode_importar_rdos is
  'Libera a aba "Importar RDOs" (rota /input) e as permissões de escrita associadas (rdo_relatorios, obras_escopos) para um usuário comum, com as mesmas permissões de um admin nessa aba específica. Padrão false (diferente de ferramentas_permitidas): só passa a valer quando a conta master marcar explicitamente. Só a conta master pode alterar (ver trigger restringir_ferramentas_permitidas_update, atualizado nesta migration).';

-- Função auxiliar (mesmo padrão de is_admin(), migration 0002): quem pode
-- gerenciar a aba Importar RDOs — admins sempre, mais quem tiver a
-- permissão explícita.
create or replace function public.pode_gerenciar_rdo_input()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin or pode_importar_rdos from public.perfis where id = auth.uid()),
    false
  )
$$;

-- Reescreve as policies de escrita de rdo_relatorios e obras_escopos que
-- hoje checam só is_admin() (migrations 0005/0006/0007), pra também
-- liberar quem tem pode_importar_rdos = true — sem isso, a aba destravada
-- na interface esbarraria em RLS na hora de importar/editar de verdade.
drop policy if exists "Admins podem inserir rdo_relatorios" on public.rdo_relatorios;
create policy "Quem gerencia RDOs pode inserir rdo_relatorios"
  on public.rdo_relatorios
  for insert
  to authenticated
  with check (public.pode_gerenciar_rdo_input() and usuario_id = auth.uid());

drop policy if exists "Admins podem deletar rdo_relatorios" on public.rdo_relatorios;
create policy "Quem gerencia RDOs pode deletar rdo_relatorios"
  on public.rdo_relatorios
  for delete
  to authenticated
  using (public.pode_gerenciar_rdo_input());

drop policy if exists "Admins podem inserir obras_escopos" on public.obras_escopos;
create policy "Quem gerencia RDOs pode inserir obras_escopos"
  on public.obras_escopos
  for insert
  to authenticated
  with check (public.pode_gerenciar_rdo_input());

drop policy if exists "Admins podem atualizar obras_escopos" on public.obras_escopos;
create policy "Quem gerencia RDOs pode atualizar obras_escopos"
  on public.obras_escopos
  for update
  to authenticated
  using (public.pode_gerenciar_rdo_input())
  with check (public.pode_gerenciar_rdo_input());

drop policy if exists "Admins podem deletar obras_escopos" on public.obras_escopos;
create policy "Quem gerencia RDOs pode deletar obras_escopos"
  on public.obras_escopos
  for delete
  to authenticated
  using (public.pode_gerenciar_rdo_input());

-- Amplia o trigger de proteção da personalização (migration 0014) pra
-- também cobrir esta coluna nova: só a conta master pode alterar
-- ferramentas_permitidas OU pode_importar_rdos de outro usuário.
create or replace function public.restringir_ferramentas_permitidas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    NEW.ferramentas_permitidas is distinct from OLD.ferramentas_permitidas
    or NEW.pode_importar_rdos is distinct from OLD.pode_importar_rdos
  ) and not public.is_master() then
    raise exception 'Só a conta master pode personalizar o acesso a ferramentas.';
  end if;
  return NEW;
end;
$$;
