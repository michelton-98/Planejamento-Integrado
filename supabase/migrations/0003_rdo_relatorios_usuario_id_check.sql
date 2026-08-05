-- A página /input agora envia usuario_id explicitamente a partir do
-- cliente. Reforça a policy de insert para exigir que esse valor seja
-- sempre o do próprio usuário autenticado (além de aprovado), evitando que
-- alguém atribua um relatório a outro usuário.
drop policy if exists "Usuários aprovados podem inserir rdo_relatorios" on public.rdo_relatorios;

create policy "Usuários aprovados podem inserir rdo_relatorios"
  on public.rdo_relatorios
  for insert
  to authenticated
  with check (public.is_approved() and usuario_id = auth.uid());
