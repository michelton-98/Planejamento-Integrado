-- Ferramenta "Histograma" (/histograma): efetivo de mão de obra (Previsto x
-- Realizado x Projeção) por Empresa + Disciplina + Data de referência.
-- Totalmente independente das demais tabelas do sistema (mesmo espírito de
-- validacoes_escopos/avanco_arquivos, migrations 0010/0016).
--
-- Só guarda os DADOS extraídos do .csv enviado (aba Input, ver
-- src/lib/histogramaData.js) — nunca o arquivo bruto/storage_path: mesmo
-- espírito da correção feita no Avanço Integrado da FORTYS (migration
-- 0022), o arquivo original nunca sai do navegador de quem envia.
--
-- disciplina é texto livre (sem check constraint), mesmo motivo de
-- disciplina/empresa/escopo em avanco_arquivos (migration 0016): a lista
-- das 5 disciplinas válidas hoje vive só em src/lib/histogramaData.js
-- (DISCIPLINAS_HISTOGRAMA).
create table if not exists public.histograma_efetivo (
  id uuid primary key default gen_random_uuid(),
  data_referencia date not null,
  empresa text not null,
  disciplina text not null,
  tipo_mo text,
  previsto integer,
  realizado integer,
  projecao integer,
  -- Quem enviou: uuid (auditoria/FK) + cópia de nome/e-mail no próprio
  -- registro, mesmo padrão de avanco_arquivos.enviado_por* (migration 0016).
  enviado_por uuid references auth.users (id) on delete set null,
  enviado_por_nome text,
  enviado_por_email text,
  criado_em timestamptz not null default now()
);

create index if not exists histograma_efetivo_data_referencia_idx
  on public.histograma_efetivo (data_referencia);

alter table public.histograma_efetivo enable row level security;

-- Ferramenta colaborativa aberta a QUALQUER usuário aprovado (mesmo padrão
-- de validacoes_escopos/avanco_arquivos) — não só admins.
create policy "Aprovados podem ler histograma_efetivo"
  on public.histograma_efetivo
  for select
  to authenticated
  using (public.is_approved());

create policy "Aprovados podem inserir histograma_efetivo"
  on public.histograma_efetivo
  for insert
  to authenticated
  with check (public.is_approved());

-- Reenvio da mesma data_referencia apaga (DELETE) todas as linhas antigas
-- daquela data antes de inserir as novas (ver enviarHistogramaEfetivo em
-- src/lib/histogramaData.js) — substitui o snapshot inteiro da data, nunca
-- faz update linha a linha.
create policy "Aprovados podem excluir histograma_efetivo"
  on public.histograma_efetivo
  for delete
  to authenticated
  using (public.is_approved());
