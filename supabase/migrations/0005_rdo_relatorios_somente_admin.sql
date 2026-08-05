-- A importação de RDOs (/input) agora é restrita a administradores na UI.
-- Reforça isso no banco: só quem tem is_admin = true pode inserir em
-- rdo_relatorios (mantendo a exigência de usuario_id = auth.uid()). A
-- leitura continua liberada para qualquer usuário aprovado — o dashboard
-- não é uma função exclusiva de admin.
drop policy if exists "Usuários aprovados podem inserir rdo_relatorios" on public.rdo_relatorios;

create policy "Admins podem inserir rdo_relatorios"
  on public.rdo_relatorios
  for insert
  to authenticated
  with check (public.is_admin() and usuario_id = auth.uid());
