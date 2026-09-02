-- Ferramenta "Avanço Integrado" — parsing automático dos 2 arquivos .xlsx
-- semanais da QUALISOLDA (um por escopo: "Interligação de Carbono" e
-- "Interligação de Inox e Equipamentos"), mesmo espírito do parsing da
-- FORTYS (migration 0019): o arquivo bruto nunca sobe ao Storage, só os
-- dados já extraídos (ver src/lib/qualisoldaXlsxParse.js).
--
-- Duas tabelas novas, mesmo padrão RLS de avanco_indicadores (migration
-- 0019): abertas a qualquer usuário aprovado, FK arquivo_id -> avanco_
-- arquivos.id on delete cascade. Reenvio da mesma combinação Empresa+
-- Escopo+Data apaga (DELETE) e reinsere as linhas filhas pro arquivo_id
-- (ver enviarArquivoQualisoldaXlsx em src/lib/avancoIntegradoData.js).

-- Itens de tubulação (isométricos) + o resumo de Suportes de cada material
-- — uma linha por isométrico, mais 1 linha "resumo" de Suportes por
-- material (tipo_registro = 'suporte_resumo', isometrico = null; ver
-- SUPORTES_LABEL em qualisoldaXlsxParse.js pro rótulo fixo exibido no lugar
-- do nome do isométrico).
create table if not exists public.avanco_itens_tubulacao (
  id uuid primary key default gen_random_uuid(),
  arquivo_id uuid not null references public.avanco_arquivos (id) on delete cascade,
  tipo_registro text not null check (tipo_registro in ('isometrico', 'suporte_resumo')),
  material text not null check (material in ('carbono', 'inox')),
  area text,
  isometrico text,
  diametro numeric,
  peso_total numeric not null,
  peso_lista_material numeric,
  percentual_fabricacao numeric,
  percentual_montagem numeric,
  percentual_pintura numeric,
  percentual_total numeric,
  peso_executado numeric,
  criado_em timestamptz not null default now()
);

create index if not exists avanco_itens_tubulacao_arquivo_id_idx on public.avanco_itens_tubulacao (arquivo_id);

alter table public.avanco_itens_tubulacao enable row level security;

create policy "Aprovados podem ler avanco_itens_tubulacao"
  on public.avanco_itens_tubulacao
  for select
  to authenticated
  using (public.is_approved());

create policy "Aprovados podem inserir avanco_itens_tubulacao"
  on public.avanco_itens_tubulacao
  for insert
  to authenticated
  with check (public.is_approved());

create policy "Aprovados podem excluir avanco_itens_tubulacao"
  on public.avanco_itens_tubulacao
  for delete
  to authenticated
  using (public.is_approved());

-- Itens da sheet "MC Equipamentos" (só existe no escopo Inox/Equipamentos)
-- — classificação normalizada em 2 valores (CONDENSADOR entra como
-- EQUIPAMENTO, ver qualisoldaXlsxParse.js) por só existir 1 item assim hoje.
create table if not exists public.avanco_itens_equipamento (
  id uuid primary key default gen_random_uuid(),
  arquivo_id uuid not null references public.avanco_arquivos (id) on delete cascade,
  tipo_equipamento text,
  tag text,
  classificacao text not null check (classificacao in ('EQUIPAMENTO', 'TORRE')),
  peso_total numeric not null,
  percentual_icamento numeric,
  percentual_alinhamento numeric,
  percentual_fixacao numeric,
  percentual_total numeric,
  peso_executado numeric,
  criado_em timestamptz not null default now()
);

create index if not exists avanco_itens_equipamento_arquivo_id_idx on public.avanco_itens_equipamento (arquivo_id);

alter table public.avanco_itens_equipamento enable row level security;

create policy "Aprovados podem ler avanco_itens_equipamento"
  on public.avanco_itens_equipamento
  for select
  to authenticated
  using (public.is_approved());

create policy "Aprovados podem inserir avanco_itens_equipamento"
  on public.avanco_itens_equipamento
  for insert
  to authenticated
  with check (public.is_approved());

create policy "Aprovados podem excluir avanco_itens_equipamento"
  on public.avanco_itens_equipamento
  for delete
  to authenticated
  using (public.is_approved());

-- % avanço de Equipamentos à parte (soma peso_executado / soma peso_total
-- de avanco_itens_equipamento) — só preenchido pro escopo "Interligação de
-- Inox e Equipamentos" da QUALISOLDA; NULL pro escopo Carbono (que não tem
-- equipamentos) e pra qualquer outro fluxo (FORTYS, genérico).
-- percentual_executado_geral (migration 0020) segue cobrindo tubulação +
-- suportes nos dois escopos da QUALISOLDA; percentual_previsto_geral
-- continua NULL (não existe conceito de "previsto" nesse fluxo).
alter table public.avanco_arquivos
  add column if not exists percentual_equipamentos_geral numeric;

comment on column public.avanco_arquivos.percentual_equipamentos_geral is
  '% avanço geral de Equipamentos (peso_executado / peso_total da sheet MC Equipamentos), só pro escopo "Interligação de Inox e Equipamentos" da QUALISOLDA. NULL em qualquer outro caso.';
