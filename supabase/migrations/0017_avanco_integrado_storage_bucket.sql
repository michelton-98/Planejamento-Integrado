-- Bucket de Storage pros arquivos da ferramenta "Avanço Integrado" (ver
-- migration 0016 e src/lib/avancoIntegradoData.js). Privado (public =
-- false): leitura passa pela policy abaixo (public.is_approved()), nunca
-- por URL pública direta — o front-end baixa via supabase.storage
-- .download(), que respeita RLS.
--
-- Se a Dashboard do Supabase (Studio) não expuser o bucket criado por este
-- INSERT direto (alguns projetos restringem storage.buckets a inserts
-- feitos pela própria Storage API), crie o bucket manualmente em
-- Storage > New bucket: nome "avanco-arquivos", privado, limite 20 MB — e
-- rode só as policies de storage.objects logo abaixo.
insert into storage.buckets (id, name, public, file_size_limit)
values ('avanco-arquivos', 'avanco-arquivos', false, 20971520)
on conflict (id) do nothing;

-- Ferramenta colaborativa aberta a QUALQUER usuário aprovado, mesmo
-- padrão de acesso das tabelas da ferramenta (migration 0016) — qualquer
-- aprovado pode enviar, ler, substituir (update) e remover arquivos.
create policy "Aprovados podem ler avanco-arquivos"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'avanco-arquivos' and public.is_approved());

create policy "Aprovados podem enviar avanco-arquivos"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'avanco-arquivos' and public.is_approved());

create policy "Aprovados podem substituir avanco-arquivos"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'avanco-arquivos' and public.is_approved())
  with check (bucket_id = 'avanco-arquivos' and public.is_approved());

create policy "Aprovados podem excluir avanco-arquivos"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'avanco-arquivos' and public.is_approved());
