-- Ferramenta "Avanço Integrado": tabela dos arquivos de avanço enviados
-- por Fase + Disciplina + Empresa + Escopo + Data de referência (aba
-- Input, ver src/components/avanco/AvancoInput.jsx). Totalmente
-- independente das tabelas de RDO/Validações.
--
-- disciplina/empresa/escopo são texto livre (sem check constraint, ao
-- contrário de validacoes_escopos.disciplina) DE PROPÓSITO: a lista de
-- combinações válidas vive só em src/lib/avancoIntegradoConfig.js, e vai
-- crescer bastante nos próximos prompts (mais disciplinas, mais fases) —
-- prender isso no banco via check() exigiria uma migration nova a cada
-- combinação liberada. Quem garante que só entra combinação válida é a
-- interface (seletores dependentes, sempre lendo do config).
create table if not exists public.avanco_arquivos (
  id uuid primary key default gen_random_uuid(),
  fase text not null,
  disciplina text not null,
  empresa text not null,
  escopo text not null,
  data_referencia date not null,
  storage_path text not null,
  nome_arquivo text not null,
  tamanho_bytes bigint,
  -- Quem enviou: uuid (auditoria/FK) + cópia de nome/e-mail no próprio
  -- registro, mesmo padrão de validacoes_semanais.criado_por* (migration
  -- 0010) — ferramenta aberta a todo aprovado, e a leitura de perfis de
  -- OUTRO usuário é restrita a admins.
  enviado_por uuid references auth.users (id) on delete set null,
  enviado_por_nome text,
  enviado_por_email text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- No máximo 1 arquivo "vigente" por combinação exata — reenvio pra
  -- mesma combinação SUBSTITUI o registro (UPDATE), nunca duplica (ver
  -- enviarArquivoAvanco em src/lib/avancoIntegradoData.js).
  unique (fase, disciplina, empresa, escopo, data_referencia)
);

create index if not exists avanco_arquivos_fase_idx on public.avanco_arquivos (fase);
create index if not exists avanco_arquivos_empresa_idx on public.avanco_arquivos (fase, empresa);

-- atualizado_em automático, mesmo padrão de validacoes_escopos (migration 0010).
create or replace function public.tocar_avanco_arquivos_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists avanco_arquivos_atualizado_em on public.avanco_arquivos;
create trigger avanco_arquivos_atualizado_em
  before update on public.avanco_arquivos
  for each row execute function public.tocar_avanco_arquivos_atualizado_em();

alter table public.avanco_arquivos enable row level security;

-- Ferramenta colaborativa aberta a QUALQUER usuário aprovado (mesmo
-- padrão de validacoes_escopos/validacoes_semanais, migration 0010) — não
-- só admins, pra quem de fato envia os arquivos de avanço conseguir usar.
create policy "Aprovados podem ler avanco_arquivos"
  on public.avanco_arquivos
  for select
  to authenticated
  using (public.is_approved());

create policy "Aprovados podem inserir avanco_arquivos"
  on public.avanco_arquivos
  for insert
  to authenticated
  with check (public.is_approved());

-- UPDATE existe (diferente de validacoes_semanais, que é histórico
-- imutável): reenvio pra mesma combinação Fase+Disciplina+Empresa+Escopo+
-- Data atualiza a MESMA linha (ver unique acima), não cria uma nova.
create policy "Aprovados podem atualizar avanco_arquivos"
  on public.avanco_arquivos
  for update
  to authenticated
  using (public.is_approved())
  with check (public.is_approved());

create policy "Aprovados podem excluir avanco_arquivos"
  on public.avanco_arquivos
  for delete
  to authenticated
  using (public.is_approved());
