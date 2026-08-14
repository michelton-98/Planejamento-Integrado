-- Indicadores extraídos automaticamente do cronograma .xml do MS Project
-- da FORTYS (ver src/lib/fortysXmlParse.js) — um registro por indicador
-- (Colunas, Nível +5000/+10000/+15000, Escadas, Plataformas — ver
-- INDICADORES_FORTYS em avancoIntegradoConfig.js) por arquivo enviado.
--
-- nome_indicador é texto livre (sem check constraint) pelo mesmo motivo de
-- disciplina/empresa/escopo em avanco_arquivos (migration 0016): a lista
-- de indicadores válidos vive só em src/lib/avancoIntegradoConfig.js.
create table if not exists public.avanco_indicadores (
  id uuid primary key default gen_random_uuid(),
  arquivo_id uuid not null references public.avanco_arquivos (id) on delete cascade,
  nome_indicador text not null,
  percentual_previsto numeric,
  percentual_executado numeric,
  criado_em timestamptz not null default now()
);

create index if not exists avanco_indicadores_arquivo_id_idx on public.avanco_indicadores (arquivo_id);

alter table public.avanco_indicadores enable row level security;

-- Mesma policy de leitura/escrita de avanco_arquivos (migration 0016):
-- ferramenta aberta a qualquer usuário aprovado. Na prática, quem grava
-- aqui é sempre a extração automática (ver enviarArquivoFortysXml em
-- avancoIntegradoData.js) — o reenvio de um XML pra mesma combinação
-- apaga os indicadores antigos (delete) antes de inserir os novos, nunca
-- faz update linha a linha.
create policy "Aprovados podem ler avanco_indicadores"
  on public.avanco_indicadores
  for select
  to authenticated
  using (public.is_approved());

create policy "Aprovados podem inserir avanco_indicadores"
  on public.avanco_indicadores
  for insert
  to authenticated
  with check (public.is_approved());

create policy "Aprovados podem atualizar avanco_indicadores"
  on public.avanco_indicadores
  for update
  to authenticated
  using (public.is_approved())
  with check (public.is_approved());

create policy "Aprovados podem excluir avanco_indicadores"
  on public.avanco_indicadores
  for delete
  to authenticated
  using (public.is_approved());
