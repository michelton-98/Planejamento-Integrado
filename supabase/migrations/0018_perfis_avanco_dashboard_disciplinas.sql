-- Filtro de disciplinas do Dashboard da ferramenta "Avanço Integrado"
-- (checkboxes "Todas as Disciplinas" / Civil / Metal / Elétrica /
-- Instrumentação, ver AvancoDashboard.jsx), persistido no perfil pra
-- sincronizar entre qualquer computador/navegador que o usuário use.
--
-- NULL = todas marcadas (padrão, inclusive no primeiro acesso de um
-- usuário que nunca mexeu nos checkboxes) — mesma convenção de
-- "nulo/vazio = tudo" já usada em ferramentas_permitidas (migration 0014).
alter table public.perfis
  add column if not exists avanco_dashboard_disciplinas text[];

comment on column public.perfis.avanco_dashboard_disciplinas is
  'Disciplinas marcadas no filtro do Dashboard de "Avanço Integrado" (ver DISCIPLINAS_AVANCO em src/lib/avancoIntegradoConfig.js). NULL = todas marcadas (padrão). Só é gravada pelo próprio usuário, via RPC set_avanco_dashboard_disciplinas — a tabela perfis não libera UPDATE direto pra usuário comum na própria linha (migration 0002).';

-- A tabela perfis só libera UPDATE pra admin (migration 0002) — um
-- usuário comum não consegue gravar esta coluna com um update direto na
-- linha. Em vez de abrir uma policy de "usuário pode atualizar o próprio
-- perfil" (que liberaria QUALQUER coluna, inclusive is_admin/
-- status_aprovacao — risco de escalonamento de privilégio), uma função
-- security definer bem específica, que só grava esta coluna e só na linha
-- do próprio auth.uid(). Mesmo espírito de is_admin()/is_approved()
-- (migration 0002).
create or replace function public.set_avanco_dashboard_disciplinas(disciplinas text[])
returns public.perfis
language plpgsql
security definer
set search_path = public
as $$
declare
  resultado public.perfis;
begin
  update public.perfis
  set avanco_dashboard_disciplinas = disciplinas
  where id = auth.uid()
  returning * into resultado;

  return resultado;
end;
$$;
