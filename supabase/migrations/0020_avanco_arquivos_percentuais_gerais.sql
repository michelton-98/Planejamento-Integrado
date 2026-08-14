-- % avanço geral (previsto x executado) do arquivo, lido direto da
-- tarefa-resumo do cronograma (ver src/lib/fortysXmlParse.js) — só
-- preenchido pra empresas de cronograma (tipoInput 'xml_ms_project', hoje
-- só FORTYS). Fica NULL pra todo o resto (ex.: QUALISOLDA, que continua no
-- upload genérico sem parsing).
alter table public.avanco_arquivos
  add column if not exists percentual_previsto_geral numeric,
  add column if not exists percentual_executado_geral numeric;

comment on column public.avanco_arquivos.percentual_previsto_geral is
  '% previsto geral do escopo nessa data, extraído automaticamente do cronograma (ver enviarArquivoFortysXml em avancoIntegradoData.js). NULL fora do fluxo de cronograma.';
comment on column public.avanco_arquivos.percentual_executado_geral is
  '% executado geral do escopo nessa data, extraído automaticamente do cronograma. NULL fora do fluxo de cronograma.';
