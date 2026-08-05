-- Tabela: rdo_relatorios
create table if not exists public.rdo_relatorios (
  id uuid primary key default gen_random_uuid(),
  data_relatorio date not null,
  numero_rdo integer not null,
  empresa text not null,
  escopo text,
  status_aprovacao text,
  responsavel_nome text,
  responsavel_email text,
  usuario_id uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);

-- Habilita Row Level Security
alter table public.rdo_relatorios enable row level security;

-- Política: usuários autenticados podem ler todos os relatórios
create policy "Usuários autenticados podem ler rdo_relatorios"
  on public.rdo_relatorios
  for select
  to authenticated
  using (true);

-- Política: usuários autenticados podem inserir relatórios
create policy "Usuários autenticados podem inserir rdo_relatorios"
  on public.rdo_relatorios
  for insert
  to authenticated
  with check (true);
