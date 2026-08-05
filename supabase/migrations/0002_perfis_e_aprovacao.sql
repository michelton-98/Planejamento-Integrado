-- Tabela: perfis
-- Um perfil por usuário de auth.users, criado automaticamente no cadastro.
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  email text,
  funcao text,
  status_aprovacao text not null default 'pendente'
    check (status_aprovacao in ('pendente', 'aprovado', 'recusado')),
  is_admin boolean not null default false,
  criado_em timestamptz not null default now()
);

-- Funções auxiliares (security definer): usadas dentro das policies de RLS
-- para checar o próprio status/permissão sem cair em recursão de RLS
-- (rodam com o privilégio do dono da função, que ignora RLS na leitura).
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.perfis where id = auth.uid()),
    false
  )
$$;

create or replace function public.is_approved()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select status_aprovacao = 'aprovado' from public.perfis where id = auth.uid()),
    false
  )
$$;

-- Gatilho: cria automaticamente o perfil (status "pendente") quando um novo
-- usuário se cadastra via supabase.auth.signUp. "nome" e "funcao" vêm do
-- options.data enviado no signUp.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, email, nome, funcao, status_aprovacao)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    coalesce(new.raw_user_meta_data ->> 'funcao', ''),
    'pendente'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Habilita Row Level Security
alter table public.perfis enable row level security;

-- Cada usuário pode ler o próprio perfil (inclusive enquanto "pendente",
-- para a UI saber o que exibir).
create policy "Usuários podem ler o próprio perfil"
  on public.perfis
  for select
  to authenticated
  using (id = auth.uid());

-- Administradores podem ler todos os perfis (tela de aprovações).
create policy "Admins podem ler todos os perfis"
  on public.perfis
  for select
  to authenticated
  using (public.is_admin());

-- Administradores podem atualizar qualquer perfil (aprovar/recusar).
-- Não há policy de insert: perfis só são criados pelo gatilho acima.
create policy "Admins podem atualizar perfis"
  on public.perfis
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Reforça em rdo_relatorios: só usuários aprovados podem ler/inserir
-- (defesa em profundidade além do bloqueio de rota no front-end).
drop policy if exists "Usuários autenticados podem ler rdo_relatorios" on public.rdo_relatorios;
drop policy if exists "Usuários autenticados podem inserir rdo_relatorios" on public.rdo_relatorios;

create policy "Usuários aprovados podem ler rdo_relatorios"
  on public.rdo_relatorios
  for select
  to authenticated
  using (public.is_approved());

create policy "Usuários aprovados podem inserir rdo_relatorios"
  on public.rdo_relatorios
  for insert
  to authenticated
  with check (public.is_approved());
