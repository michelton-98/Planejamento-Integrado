-- Mudança de decisão em relação à migration 0010: o histórico de
-- validações semanais deixa de ser 100% imutável. Agora o usuário
-- atualiza o mesmo registro conforme a validação avança ao longo da
-- semana (ex.: marca "Validado pelo Planejamento" hoje, volta depois e
-- marca "Validado pelo Especialista" no mesmo registro) — por isso
-- libera UPDATE, no mesmo padrão de policy já usado pra
-- select/insert/delete nessa tabela.
create policy "Aprovados podem atualizar validacoes_semanais"
  on public.validacoes_semanais
  for update
  to authenticated
  using (public.is_approved())
  with check (public.is_approved());
