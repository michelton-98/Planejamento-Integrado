-- Ajustes na ferramenta "Controle de Validações":
--   1) nova coluna data_recebimento (data escolhida manualmente pelo
--      usuário, distinta de criado_em que é automática) em
--      validacoes_semanais;
--   2) novo texto/opção no enum do campo consideracao.

-- --- 1) data_recebimento -----------------------------------------------

alter table public.validacoes_semanais
  add column if not exists data_recebimento date;

-- Backfill: linhas que já existirem antes desta migration não têm como o
-- usuário informar retroativamente essa data, então usamos a data do
-- próprio registro (criado_em) como aproximação — só pra permitir a
-- coluna virar NOT NULL a seguir, sem perder linhas.
update public.validacoes_semanais
set data_recebimento = criado_em::date
where data_recebimento is null;

alter table public.validacoes_semanais
  alter column data_recebimento set not null;

-- --- 2) enum de consideracao --------------------------------------------

-- Migra o texto antigo pro novo ANTES de trocar a constraint, pra não
-- deixar linha existente violando o novo check.
update public.validacoes_semanais
set consideracao = 'Documentos não recebidos'
where consideracao = 'Falha nos entregáveis semanais';

-- A constraint da migration 0010 foi criada sem nome explícito (Postgres
-- gera um nome default) — em vez de arriscar adivinhar esse nome, busca
-- dinamicamente qualquer check constraint da coluna consideracao e
-- derruba pelo nome real antes de recriar.
do $$
declare
  nome_constraint text;
begin
  select con.conname into nome_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
  where rel.relname = 'validacoes_semanais'
    and con.contype = 'c'
    and att.attname = 'consideracao';

  if nome_constraint is not null then
    execute format('alter table public.validacoes_semanais drop constraint %I', nome_constraint);
  end if;
end $$;

alter table public.validacoes_semanais
  add constraint validacoes_semanais_consideracao_check
  check (
    consideracao in (
      'Validação em Andamento',
      'Não Validado Pelo Planejamento',
      'Não Validado Pelo Especialista',
      'Validação Finalizada',
      'Escopo em Validação Inicial',
      'Documentos não recebidos'
    )
  );
