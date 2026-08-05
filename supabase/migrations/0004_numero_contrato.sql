-- Nova coluna: numero_contrato (opcional — nem todo RDO tem "CT <número>"
-- no início da coluna "Obra" do arquivo importado).
alter table public.rdo_relatorios
  add column if not exists numero_contrato text;

-- Corrige RDOs já importados antes do parser reconhecer o prefixo
-- "CT <número> - EMPRESA - ESCOPO". Antes desta correção, esses registros
-- foram divididos pela regra antiga (só no primeiro "-"), então "empresa"
-- ficou com "CT <número>" e "escopo" ficou com "EMPRESA - ESCOPO" inteiro.
-- Reextrai numero_contrato de "empresa" e resepara empresa/escopo a partir
-- do "escopo" já salvo (que ainda contém "EMPRESA - ESCOPO" intacto).
-- Não mexe em nada além disso — nenhuma linha é apagada.
update public.rdo_relatorios
set
  numero_contrato = trim(substring(empresa from '(\d+)')),
  empresa = trim(split_part(escopo, '-', 1)),
  escopo = trim(substring(escopo from position('-' in escopo) + 1))
where empresa ~* '^CT\s*\d+$'
  and position('-' in escopo) > 0;
