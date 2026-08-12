-- Ferramenta "Controle de Validações": duas tabelas novas, totalmente
-- independentes de obras_escopos/rdo_relatorios (Controle de RDO) — sem
-- nenhuma relação (FK, nome de coluna igual não conta) entre elas.

-- Tabela: validacoes_escopos (aba "Data_Base" — cadastro de escopos)
create table if not exists public.validacoes_escopos (
  id uuid primary key default gen_random_uuid(),
  numero_contrato text,
  empresa text not null,
  escopo text not null,
  status text not null default 'Ativa'
    check (status in ('Ativa', 'Concluída', 'Paralisada')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Tabela: validacoes_semanais (histórico — um registro NOVO por
-- validação semanal, nunca sobrescreve o anterior; "on delete cascade"
-- só entra em ação se o escopo em si for excluído).
create table if not exists public.validacoes_semanais (
  id uuid primary key default gen_random_uuid(),
  escopo_id uuid not null references public.validacoes_escopos (id) on delete cascade,
  validado_planejamento boolean not null default false,
  validado_especialista boolean not null default false,
  sharepoint boolean not null default false,
  consideracao text not null
    check (
      consideracao in (
        'Não Validado Pelo Planejamento',
        'Não Validado Pelo Especialista',
        'Validação Finalizada',
        'Escopo em Validação Inicial',
        'Falha nos entregáveis semanais'
      )
    ),
  criado_em timestamptz not null default now(),
  -- Quem registrou: guarda o uuid (auditoria/FK) E uma cópia de
  -- nome/e-mail no próprio registro. A cópia existe porque a leitura de
  -- perfis de OUTRO usuário é restrita a admins (ver migration 0002) —
  -- essa ferramenta é aberta a todo aprovado, então um usuário comum
  -- teria como ver "quem validou" sem poder ler o perfil de quem validou.
  criado_por uuid references auth.users (id) on delete set null,
  criado_por_nome text,
  criado_por_email text
);

create index if not exists validacoes_semanais_escopo_id_idx
  on public.validacoes_semanais (escopo_id, criado_em desc);

-- atualizado_em automático em validacoes_escopos (mesmo padrão de
-- obras_escopos, só que lá o front-end seta a coluna manualmente; aqui
-- fica garantido por trigger pra não depender de o cliente lembrar).
create or replace function public.tocar_validacoes_escopos_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists validacoes_escopos_atualizado_em on public.validacoes_escopos;
create trigger validacoes_escopos_atualizado_em
  before update on public.validacoes_escopos
  for each row execute function public.tocar_validacoes_escopos_atualizado_em();

alter table public.validacoes_escopos enable row level security;
alter table public.validacoes_semanais enable row level security;

-- Ferramenta colaborativa entre Planejamento e Especialistas: liberada
-- para QUALQUER usuário aprovado (não só admins) ler e escrever — decisão
-- tomada porque restringir a admins inviabilizaria o uso por quem
-- efetivamente faz as validações no dia a dia.
create policy "Aprovados podem ler validacoes_escopos"
  on public.validacoes_escopos
  for select
  to authenticated
  using (public.is_approved());

create policy "Aprovados podem inserir validacoes_escopos"
  on public.validacoes_escopos
  for insert
  to authenticated
  with check (public.is_approved());

create policy "Aprovados podem atualizar validacoes_escopos"
  on public.validacoes_escopos
  for update
  to authenticated
  using (public.is_approved())
  with check (public.is_approved());

create policy "Aprovados podem excluir validacoes_escopos"
  on public.validacoes_escopos
  for delete
  to authenticated
  using (public.is_approved());

create policy "Aprovados podem ler validacoes_semanais"
  on public.validacoes_semanais
  for select
  to authenticated
  using (public.is_approved());

create policy "Aprovados podem inserir validacoes_semanais"
  on public.validacoes_semanais
  for insert
  to authenticated
  with check (public.is_approved());

create policy "Aprovados podem excluir validacoes_semanais"
  on public.validacoes_semanais
  for delete
  to authenticated
  using (public.is_approved());

-- Sem policy de UPDATE em validacoes_semanais: o histórico é imutável por
-- design (cada validação nova é uma linha nova, nunca uma edição de uma
-- linha antiga).
