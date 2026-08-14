-- Aumenta o limite de tamanho do bucket "avanco-arquivos" (ver migration
-- 0017) de 20 MB pra 150 MB — os cronogramas .xml reais da FORTYS passam
-- de 90 MB (ver TAMANHO_MAXIMO_BYTES_FORTYS em avancoIntegradoData.js).
--
-- Isso só ajusta o limite do BUCKET. Alguns projetos Supabase também têm
-- um teto global de upload em Project Settings → Storage (Upload file size
-- limit) que pode estar configurado abaixo de 150 MB — esse teto é
-- exclusivo do painel, não existe coluna/tabela pra ajustar via SQL/
-- migration. Se o upload de um .xml grande falhar mesmo depois desta
-- migration, confira e aumente esse limite manualmente lá.
update storage.buckets
set file_size_limit = 157286400 -- 150 MB em bytes (150 * 1024 * 1024)
where id = 'avanco-arquivos';
