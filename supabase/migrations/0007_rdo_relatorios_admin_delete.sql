-- A importação de RDOs em /input passa a substituir o conteúdo inteiro de
-- rdo_relatorios a cada envio (o arquivo importado é sempre o snapshot
-- completo das pendências, não incremental) — precisa de uma policy de
-- DELETE, que não existia até aqui (só select/insert). Restrita a admins,
-- mesmo padrão das demais escritas nessa tabela.
create policy "Admins podem deletar rdo_relatorios"
  on public.rdo_relatorios
  for delete
  to authenticated
  using (public.is_admin());
