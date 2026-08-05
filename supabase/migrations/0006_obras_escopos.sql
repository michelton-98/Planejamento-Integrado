-- Tabela: obras_escopos ("Escopos - Rondonópolis")
-- Cadastro das obras com disciplina e status de execução, usado para
-- filtrar quais RDOs pendentes (rdo_relatorios) devem contar no dashboard
-- (só obras com status = 'Obra em Andamento' entram nas pendências).
create table if not exists public.obras_escopos (
  id uuid primary key default gen_random_uuid(),
  numero_contrato text,
  empresa text not null,
  escopo text not null,
  disciplina text
    check (disciplina in ('Civil', 'Metal', 'Elétrica', 'Instrumentação', 'Rotativos', 'Qualidade')),
  status text not null default 'Obra em Andamento'
    check (status in ('Obra Concluída', 'Obra não iniciada', 'Obra em Andamento', 'Obra Paralisada')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.obras_escopos enable row level security;

-- Leitura liberada para qualquer usuário aprovado: o dashboard (todo mundo
-- aprovado) precisa cruzar rdo_relatorios com obras_escopos para saber
-- quais pendências considerar.
create policy "Usuários aprovados podem ler obras_escopos"
  on public.obras_escopos
  for select
  to authenticated
  using (public.is_approved());

-- Escrita restrita a administradores (mesma regra de /input em geral).
create policy "Admins podem inserir obras_escopos"
  on public.obras_escopos
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins podem atualizar obras_escopos"
  on public.obras_escopos
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins podem deletar obras_escopos"
  on public.obras_escopos
  for delete
  to authenticated
  using (public.is_admin());
