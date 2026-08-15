-- O fluxo de cronograma (.xml do MS Project, hoje só FORTYS) parou de
-- subir o arquivo pro Storage — o .xml nunca sai do navegador do usuário,
-- só é lido em memória pelo Worker pra extrair os percentuais (ver
-- enviarArquivoFortysXml em src/lib/avancoIntegradoData.js). storage_path
-- passa a aceitar NULL pra esses registros; nome_arquivo/tamanho_bytes
-- continuam preenchidos, só como referência de qual arquivo original
-- gerou aqueles números — nunca o conteúdo em si.
--
-- Fluxo genérico (QUALISOLDA e qualquer outro upload de arquivo de
-- verdade) continua exigindo storage_path na prática (a aplicação sempre
-- grava o caminho ali) — só relaxa a constraint do banco, não muda o
-- comportamento desse outro fluxo.
alter table public.avanco_arquivos
  alter column storage_path drop not null;

comment on column public.avanco_arquivos.storage_path is
  'Caminho no Storage do bucket avanco-arquivos. NULL no fluxo de cronograma (.xml MS Project, ver enviarArquivoFortysXml) — o arquivo original não é enviado ao Storage, só lido em memória pra extrair os percentuais (avanco_indicadores / percentual_previsto_geral / percentual_executado_geral).';
