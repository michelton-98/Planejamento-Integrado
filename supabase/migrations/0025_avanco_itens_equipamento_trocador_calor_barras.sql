-- Ferramenta "Avanço Integrado" — painel "Gestão Visual" do Dashboard de
-- Destilaria Fase I: card "Trocador de Calor de Barras" precisa saber
-- quais itens de avanco_itens_equipamento (migration 0024) são um trocador
-- de calor de barras — marcação manual de engenharia, independente de
-- tipo_equipamento (pode marcar Aquecedor, Bomba, Evaporador etc.), lida da
-- coluna N ("SIM"/vazio) da sheet "MC Equipamentos" (ver
-- src/lib/qualisoldaXlsxParse.js) — "SIM" (sem diferenciar maiúsculas) vira
-- true, qualquer outro valor (inclusive célula vazia) vira false.
alter table public.avanco_itens_equipamento
  add column if not exists trocador_calor_barras boolean not null default false;

comment on column public.avanco_itens_equipamento.trocador_calor_barras is
  'Marcação manual de engenharia (coluna N da sheet "MC Equipamentos", "SIM" = true) — independente de tipo_equipamento/classificacao. Usada no card "Trocador de Calor de Barras" do painel Gestão Visual.';
