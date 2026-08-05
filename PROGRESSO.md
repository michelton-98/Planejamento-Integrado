# Progresso do projeto — Controle RDO

Resumo do que foi construído até agora, decisões tomadas, arquivos
envolvidos e o que ainda falta. Atualizado em 2026-08-05 (pacote de
alterações: escopos/disciplina, filtro do dashboard, gauges).

## Stack

React 19 + Vite 8 + Tailwind CSS v4, backend em Supabase (Auth + Postgres
com RLS). Gráficos com `recharts`, parsing de CSV/XLSX com `papaparse` +
`xlsx` (build corrigido do SheetJS, não a do npm — ver seção de segurança),
PDF gerado no navegador com `jspdf` + `jspdf-autotable`. Deploy na Vercel.

## Funcionalidades implementadas

### 1. Autenticação e controle de acesso
- Login por e-mail/senha (Supabase Auth), com tela redesenhada (faixa de
  logos INPASA/PLAORC, fundo azul-marinho em gradiente, card branco).
- Cadastro público (nome, e-mail, senha, função) — conta nasce com
  `status_aprovacao = 'pendente'` via gatilho no banco (não dá pra se
  auto-aprovar).
- Aprovação de cadastros em `/admin/aprovacoes` (só admins): aprovar/recusar
  atualiza `status_aprovacao` e, opcionalmente, concede `is_admin` no mesmo
  clique.
- Recuperação de senha completa: `/esqueci-senha` → e-mail via
  `resetPasswordForEmail` → `/redefinir-senha` (usa a sessão de recuperação
  do Supabase + `updateUser`).
- Proteção de rotas: `ProtectedRoute` (exige aprovado), `AdminRoute` (exige
  `is_admin`). `/input` (importação) é restrita a admins — tanto na UI
  quanto via RLS no banco.

### 2. Importação de RDOs (`/input`, admin-only)
- Upload de `.csv` ou `.xlsx` com parsing e validação linha a linha antes
  do envio (pré-visualização com erros destacados).
- Regras de parsing da coluna "Obra": `EMPRESA - ESCOPO`, com suporte ao
  prefixo opcional `CT <número> -` (número de contrato).
- Detecção automática de delimitador (`,` ou `;`) e de encoding
  (UTF-8 ou Windows-1252/Latin-1).
- Desembrulha células no formato `="valor"` (truque de "forçar texto" do
  Excel) antes de aplicar as regras.
- Tratamento de erro robusto: arquivo vazio, corrompido, formato inválido,
  limite de 15 MB, mensagens específicas para cada caso.
- Loading states em toda a jornada (parsing, envio) com componente
  `Spinner` reutilizável.

### 3. Dashboard (`/`)
- 4 cards de indicador com cor semântica (número + faixa superior na mesma
  cor): **Total a Aprovar** (neutro/navy), **Aprovações Atrasadas**
  (alerta/vermelho), **Pendentes: Contratada** e **Pendentes: Especialista**
  (informativo/azul médio).
- Regra de atraso centralizada em `calcularStatusPrazo` (mais de 2 dias
  úteis entre `data_relatorio` e a data de referência = atrasado), com nota
  explicativa visível no dashboard.
- "Data de referência" que se auto-atualiza à meia-noite local, sem precisar
  de reload nem de novo deploy.
- Gráfico de evolução diária (15 dias), 4 categorias empilhadas
  (contratada/especialista × no prazo/atrasada).
- Top 5 empresas e Top 5 especialistas com mais pendências atrasadas —
  interativos: clicar numa barra sincroniza o toggle e a seleção do
  explorador de pendências logo abaixo (com scroll automático).
- Heatmap de volume de RDOs (estilo GitHub, ~90 dias), com tooltip no hover
  e lista de RDOs do dia ao clicar.
- Ranking dos 10 termos mais recorrentes no campo "Escopo" entre pendências
  atrasadas, clicável (abre tabela de detalhe filtrada).
- Explorador de pendências: toggle Contratada/Especialista, lista de
  nomes com contagem, tabela de detalhe (Contrato, Data, Prazo, Escopo,
  Contratada/Especialista).
- Exportação de PDF ("Exportar relatório do dia"): cabeçalho com as logos,
  resumo executivo, Top 5, lista completa de especialistas — gerado
  100% no navegador.

### 4. Identidade visual
- Paleta de marca (INPASA/PLAORC): `navy` `#12263f`, `accent` `#2f6fed`,
  `alert` `#d1495b`, `success` `#178a54`, `gold` `#a9791f`, fundo `surface`
  `#f5f6f8` — tokens em `src/index.css` via `@theme` do Tailwind v4.
  Combinações categóricas validadas com o script do skill de dataviz
  (contraste, distinção para daltonismo).
- Componente `Card` reutilizável (cantos arredondados, sombra suave sem
  borda, faixa colorida no topo, categoria em caixa-alta) aplicado em
  todas as telas — não só no dashboard.

### 5. Escopos - Rondonópolis (`obras_escopos`) e filtro do dashboard por status de obra
- Nova tabela `obras_escopos` (migration `0006`, **ainda não aplicada em
  produção** — ver Pendências): `numero_contrato`, `empresa`, `escopo`,
  `disciplina` (Civil/Metal/Elétrica/Instrumentação/Rotativos/Qualidade,
  opcional) e `status` (Obra Concluída / não iniciada / em Andamento /
  Paralisada, default "em Andamento"). RLS: leitura para qualquer
  aprovado, escrita só admin.
- Em `/input`, nova seção "Escopos - Rondonópolis" (admin-only, abaixo da
  importação de RDO): upload de planilha `.xlsx` (colunas "Obra" e
  "Status"), reaproveitando o parser de "EMPRESA - ESCOPO" /
  "CT nº - EMPRESA - ESCOPO" já usado nos RDOs. Normaliza o texto de
  status pra uma das 4 opções oficiais (tolera variações como "Não
  iniciada", ignora o prefixo "Obra"); quando não reconhece, usa "Obra em
  Andamento" e destaca a linha em âmbar na pré-visualização para revisão
  manual. Ao confirmar, faz merge em `obras_escopos` (atualiza status de
  quem já existe, insere quem é novo com disciplina em branco).
- Logo abaixo, tabela editável (só visível pra admin) com as obras
  cadastradas: Disciplina e Status são dropdowns com autosave (salva no
  Supabase ao trocar, sem botão "salvar"); dá pra adicionar linha manual
  e remover linha.
- **O dashboard inteiro (cards, heatmap, top 5, explorador, disciplinas)
  agora só conta RDOs cuja obra correspondente está "Obra em Andamento"**
  — a correspondência usa `numero_contrato` quando existe nos dois lados,
  senão `empresa + escopo` (tolerante a maiúsculas/espaços). RDO sem obra
  cadastrada correspondente conta como "em Andamento" por padrão (nunca é
  descartado). Lógica de correspondência centralizada em
  `src/lib/obraMatching.js`, reaproveitada tanto no merge da importação
  quanto no filtro do dashboard.
- O quadro "Termos de escopo mais recorrentes em atraso" foi **substituído**
  por "Pendências por Disciplina": lista fixa (Civil, Metal, Elétrica,
  Instrumentação, Rotativos, Qualidade) com disciplinas de contagem zero
  afundando pro fim da lista; clicável, abre tabela de detalhe
  (Contrato | Data | Empresa — Escopo | Especialista | Status).
- O gráfico de barras "Evolução diária — últimos 15 dias" foi
  **substituído** por dois gauges de meia-rosca lado a lado, ao lado do
  heatmap: "Taxa de Atraso" (atrasadas / total) e "Especialista x
  Contratada" (participação de cada estágio nas pendências). Gauge
  desenhado em SVG puro (`GaugeChart.jsx`) em vez de `recharts`, porque
  precisa de múltiplos segmentos coloridos no mesmo arco.
- Nova ordem das seções do dashboard: cards → heatmap + gauges →
  explorador de pendências → Top 5 empresas/especialistas → pendências
  por disciplina.
- Faixa de logos INPASA/PLAORC removida do topo de **todas** as telas de
  autenticação (`AuthLayout.jsx` é compartilhado por Login, Cadastro,
  Esqueci senha, Redefinir senha, Aguardando aprovação) — decisão
  confirmada com o usuário, não só a tela de Login.
- Parsing de arquivo (`.csv`/`.xlsx`) refatorado: helpers genéricos
  (leitura, desembrulho de células, split "EMPRESA - ESCOPO") extraídos
  para `src/lib/fileParsingUtils.js`, reaproveitados por
  `rdoImportParser.js` (RDOs) e pelo novo `obrasEscoposParser.js`
  (Escopos - Rondonópolis).

### 6. Notificação por e-mail de novo cadastro
- Edge Function `supabase/functions/notificar-novo-cadastro/index.ts`
  (Deno): recebe o payload de um trigger de banco, rebusca o perfil por
  `id` (nunca confia no corpo recebido — evita e-mail forjado se alguém
  descobrir a URL), busca todos os admins aprovados em `perfis` e envia
  e-mail via API do Resend (`RESEND_API_KEY`, secret da function — **não
  está no código**, ver Pendências).
- **Gatilho configurado via Database Webhooks do painel, não por
  migration SQL**: a primeira tentativa (migration `0008` original,
  `create trigger ... execute function supabase_functions.http_request`)
  falhou com `schema "supabase_functions" does not exist` — esse schema
  só é provisionado pelo próprio painel na primeira vez que a feature de
  Webhooks é habilitada, uma migration comum não consegue criar isso. A
  migration `0008` agora é só um no-op documentando a configuração real:
  **Database → Webhooks → Create a new webhook** — table `perfis`, evento
  só `Insert`, tipo `Supabase Edge Functions`, function
  `notificar-novo-cadastro`. A condição "só quando `status_aprovacao =
  'pendente'`" não dá pra configurar na UI de Webhooks (só filtra por
  tabela+evento) — por isso está garantida dentro da própria Edge
  Function, que rebusca o perfil e confere o status antes de enviar.
- **Ainda não deployada** — Edge Functions não são aplicadas por SQL
  Editor. Ver Pendências para o passo a passo (CLI ou painel).

## Decisões técnicas relevantes

- **`xlsx` via CDN do SheetJS, não do npm**: a versão no registro do npm
  tem vulnerabilidades sem correção lá; a build corrigida só está no CDN
  oficial do mantenedor.
- **Animações do recharts desativadas** (`isAnimationActive={false}`): bug
  real encontrado em ambiente headless (rAF suspenso fazia as barras não
  renderizarem); também deixa o dashboard mais responsivo a atualizações.
- **Todas as agregações do dashboard rodam no cliente** a partir de um
  único `fetchRdoRelatorios()`, sem views/RPCs no Postgres — simples de
  manter, mas não escala indefinidamente (ver pendências).
- **Design system unificado só no modo claro**: as variantes `dark:` que
  existiam em algumas telas foram removidas para não ter dois sistemas
  visuais divergentes.
- **RLS reforçada em paralelo à UI**: toda restrição de acesso na tela
  (ex.: `/input` só admin) tem o espelho correspondente em política do
  Postgres, para não depender só do front-end.

## Arquivos principais

```
src/
  App.jsx                              Rotas e layout geral
  index.css                            Paleta de marca (tokens Tailwind)
  lib/
    supabaseClient.js                  Cliente Supabase (env vars)
    AuthContext.jsx                    Sessão, perfil, login/signup/reset
    fileParsingUtils.js                Helpers genéricos de leitura/parsing de .csv/.xlsx
    rdoImportParser.js                 Parsing/validação de RDOs
    obrasEscoposParser.js              Parsing/validação de Escopos - Rondonópolis
    obraMatching.js                    Correspondência RDO ↔ obra (contrato / empresa+escopo)
    obrasEscoposData.js                CRUD + merge de importação de obras_escopos
    dashboardData.js                   Toda a lógica de agregação do dashboard
    pdfReport.js                       Geração do PDF do relatório diário
  components/
    Card.jsx, Spinner.jsx              Componentes de UI reutilizáveis
    Header.jsx, ProtectedRoute.jsx, AdminRoute.jsx
    auth/AuthLayout.jsx                Layout das telas de autenticação
    input/                             ObrasEscoposImport, ObrasEscoposTable
    dashboard/                         StatCard, gauges, heatmap, ranking por disciplina, explorador
  pages/
    Login, Cadastro, EsqueciSenha, RedefinirSenha, AguardandoAprovacao
    Home.jsx                           Dashboard
    Input.jsx                          Importação de RDOs + Escopos - Rondonópolis
    admin/Aprovacoes.jsx               Aprovação de cadastros

supabase/migrations/
  0001_create_rdo_relatorios.sql       Tabela principal + RLS
  0002_perfis_e_aprovacao.sql          Tabela perfis, gatilho de cadastro, RLS
  0003_rdo_relatorios_usuario_id_check.sql   usuario_id = auth.uid() no insert
  0004_numero_contrato.sql             Coluna numero_contrato + correção retroativa
  0005_rdo_relatorios_somente_admin.sql      Insert restrito a admins
  0006_obras_escopos.sql               Tabela obras_escopos ("Escopos - Rondonópolis") + RLS
  0007_rdo_relatorios_admin_delete.sql       Policy de DELETE em rdo_relatorios pra admins
  0008_notificar_novo_cadastro_trigger.sql   No-op — gatilho real é um Database Webhook (ver texto)

supabase/functions/
  notificar-novo-cadastro/index.ts     E-mail aos admins via Resend (novo cadastro pendente)

vercel.json                            Rewrite de SPA para a Vercel
```

## Pendências / próximos passos

- **Deployar a Edge Function `notificar-novo-cadastro`**, configurar a
  secret `RESEND_API_KEY` (e opcionalmente `RESEND_FROM_EMAIL`), e criar o
  Database Webhook (Database → Webhooks → table `perfis`, evento
  `Insert`, tipo `Supabase Edge Functions`, function
  `notificar-novo-cadastro`) — ver seção 6 acima. Sem isso, cadastro novo
  continua funcionando normalmente, só o e-mail de aviso não sai.
- **Aplicar as migrations `0006` e `0007` no Supabase** (SQL Editor, na
  ordem) — pendentes de sessões anteriores. A `0008` é só documentação
  (no-op), não precisa ser "aplicada" de verdade.
- **Aplicar a migration `0006_obras_escopos.sql` no Supabase** (SQL
  Editor) — ainda não foi aplicada. Sem ela, a nova seção "Escopos -
  Rondonópolis" em `/input` e o filtro do dashboard por status de obra não
  funcionam (o dashboard cai no comportamento padrão de tratar todo RDO
  como "em Andamento", já que `obras_escopos` não existiria/estaria
  vazia).
- **Aplicar as migrations 0001 → 0005 no Supabase**, se ainda não foram
  (já confirmado nesta sessão via checagem read-only que 0001, 0002,
  0004 e 0005 parecem aplicadas em produção — 0003 não foi possível
  confirmar diretamente, mas é bem provável que sim).
- **Configurar as variáveis de ambiente na Vercel**
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — não vão no git por
  design (`.env` é ignorado).
- **Confirmar as Redirect URLs no Supabase** (Authentication → URL
  Configuration) incluem o domínio de produção, para o link de
  recuperação de senha funcionar.
- **Marcar o primeiro usuário como admin** manualmente na tabela `perfis`
  (Table Editor do Supabase) — depois disso, novos admins podem ser
  promovidos direto pela tela de aprovações.
- **Testar o fluxo ponta a ponta em produção** com dados reais (cadastro,
  aprovação, importação de RDO, export de PDF) — até agora foi tudo testado
  com dados fictícios em ambiente de desenvolvimento.
- **Escalabilidade da agregação client-side**: se o volume de RDOs crescer
  muito, buscar tudo e agregar no navegador pode ficar lento — nesse caso
  vale migrar para views/RPCs no Postgres.
- **Code-splitting**: o build já avisa que o bundle final passa de 500 KB
  (puxado principalmente por `xlsx`, `jspdf` e `recharts`) — dá pra
  melhorar com `import()` dinâmico nas páginas `/input` e no botão de
  exportar PDF, que não precisam carregar no primeiro acesso ao
  dashboard.
- **Pasta `Logos/` duplicada na raiz**: os PNGs originais ficaram tanto em
  `Logos/` quanto em `public/logos/` (que é o que o app realmente usa) —
  pode remover a da raiz se quiser.
