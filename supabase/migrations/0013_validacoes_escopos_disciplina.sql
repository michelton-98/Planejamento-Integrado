-- Campo "Disciplina" no cadastro de escopo da aba Data_Base (Controle de
-- Validações): dropdown fixo, igual em espírito ao de obras_escopos
-- (migration 0006), mas SEM "Qualidade" — lista própria dessa ferramenta.
--
-- Nullable de propósito: escopos cadastrados antes desta migration ficam
-- sem disciplina definida (a interface mostra "Não informado" nesse caso)
-- até serem editados manualmente. A obrigatoriedade em cadastros NOVOS é
-- validada só no front-end (ver ValidacoesDataBase.jsx) — não há
-- "not null" aqui para não quebrar as linhas já existentes.
alter table public.validacoes_escopos
  add column if not exists disciplina text
    check (disciplina is null or disciplina in ('Civil', 'Metal', 'Elétrica', 'Instrumentação', 'Rotativos'));
