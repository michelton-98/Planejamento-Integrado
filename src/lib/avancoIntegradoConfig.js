// Catálogo da ferramenta "Avanço Integrado": fases -> disciplinas ->
// empresas -> escopos. Fonte única de verdade tanto pra UI (seletores
// dependentes, cards "Em breve") quanto pros indicadores do Dashboard —
// evita hard-code espalhado e deixa fácil ligar uma disciplina/fase nova
// nos próximos prompts (só mexer aqui, sem tocar nos componentes).
//
// Só a disciplina/fase marcada `habilitada: true` aparece clicável na
// aba Input; as demais entram automaticamente como "Em breve" (ver
// AvancoInput.jsx e AvancoIntegrado.jsx, que leem essas flags).

// As 5 "fases" do sub-painel do card "Avanço Integrado". `chave` também é
// o valor gravado na coluna `fase` de avanco_arquivos — não muda depois de
// criado (é só um identificador interno, nunca exibido cru na tela).
//
// `nomeTarefaFortys`: nome (sem diferenciar maiúsculas/acentos) da
// tarefa-resumo dessa fase dentro do cronograma único .xml da FORTYS — o
// mesmo arquivo cobre as 5 fases numa única árvore de tarefas, cada uma
// numa seção própria (ver src/lib/fortysXmlParse.js, que varre o arquivo
// INTEIRO procurando as 5 de uma vez, não só a da tela onde o usuário
// enviou o arquivo). Fase sem seção encontrada no arquivo simplesmente não
// é atualizada — não é erro.
export const FASES_AVANCO = [
  {
    chave: 'destilaria_fase_1',
    titulo: 'Destilaria Fase I',
    href: '/avanco-integrado/destilaria-fase-1',
    habilitada: true,
    nomeTarefaFortys: 'DESTILARIA FASE I',
  },
  {
    chave: 'destilaria_fase_2',
    titulo: 'Destilaria Fase II',
    href: '/avanco-integrado/destilaria-fase-2',
    habilitada: true,
    nomeTarefaFortys: 'DESTILARIA FASE II',
  },
  {
    chave: 'clarificacao_oleo',
    titulo: 'Clarificação de Óleo',
    href: null,
    habilitada: false,
    nomeTarefaFortys: 'CLARIFICAÇÃO DE ÓLEO',
  },
  {
    chave: 'extracao_oleo_fase_1',
    titulo: 'Extração de Óleo Fase I',
    href: null,
    habilitada: false,
    nomeTarefaFortys: 'EXTRAÇÃO DE ÓLEO FASE I',
  },
  {
    chave: 'extracao_oleo_fase_2',
    titulo: 'Extração de Óleo Fase II',
    href: null,
    habilitada: false,
    nomeTarefaFortys: 'EXTRAÇÃO DE ÓLEO FASE II',
  },
]

// As 4 disciplinas do checklist do Dashboard e dos cards da aba Input —
// mesma lista em todas as fases (mesmo que uma fase ainda não tenha
// nenhuma disciplina habilitada pra Input).
export const DISCIPLINAS_AVANCO = ['Civil', 'Metal', 'Elétrica', 'Instrumentação']

// Os 6 indicadores fixos extraídos do cronograma MS Project da FORTYS (ver
// src/lib/fortysXmlParse.js) — mesmos nomes usados antes como "escopo" da
// FORTYS, agora reaproveitados como nome de linha da tabela de indicadores
// (ver migration 0019, tabela avanco_indicadores). A ORDEM desta lista é a
// ordem de exibição nas telas (Dashboard/Data_Base).
export const INDICADORES_FORTYS = ['Colunas', 'Nível +5000', 'Nível +10000', 'Nível +15000', 'Escadas', 'Plataformas']

// Os 2 escopos da QUALISOLDA (tipoInput 'xlsx_qualisolda', ver
// AVANCO_CONFIG abaixo) mapeados pro "tipo" de arquivo/planilha que cada um
// espera — decide qual parser rodar (ver src/lib/qualisoldaXlsxParse.js) a
// partir do escopo escolhido na Input, nunca adivinhado pelo conteúdo do
// arquivo. Nomes de escopo são a MESMA string usada em `escopos` abaixo —
// não pode divergir.
export const ESCOPO_TIPO_QUALISOLDA = {
  'Interligação de Carbono': 'carbono',
  'Interligação de Inox e Equipamentos': 'inox',
}

// Empresas -> config por disciplina, dentro de cada fase. Disciplina
// ausente aqui (ou com `empresas: {}`) = ainda sem nenhuma empresa
// cadastrada nessa fase (ver estado vazio do Dashboard/Data_Base).
//
// Cada empresa tem `escopos` (lista de opções do seletor de Escopo) e
// `tipoInput`:
//   - 'generico': upload de qualquer arquivo, sem processamento (fluxo
//     original da ferramenta).
//   - 'xml_ms_project': upload restrito a .xml do MS Project, com
//     extração automática de indicadores no navegador (só FORTYS — ver
//     AvancoInput.jsx/fortysXmlParse.js).
//   - 'xlsx_qualisolda': upload restrito a .xlsx (um por escopo — ver
//     ESCOPO_TIPO_QUALISOLDA acima), com extração automática de itens de
//     tubulação/suportes/equipamentos no navegador (só QUALISOLDA — ver
//     AvancoInput.jsx/qualisoldaXlsxParse.js).
//
// Propositalmente SEM check constraint equivalente no banco (ver migration
// 0016): a lista de disciplinas/empresas/escopos válidos vive só aqui, pra
// crescer sem precisar de migration nova a cada disciplina/fase liberada —
// a validação de combinação válida é feita na interface (seletores
// dependentes), não no Postgres.
export const AVANCO_CONFIG = {
  destilaria_fase_1: {
    Civil: { habilitada: false, empresas: {} },
    Metal: {
      habilitada: true,
      empresas: {
        QUALISOLDA: {
          tipoInput: 'xlsx_qualisolda',
          escopos: ['Interligação de Carbono', 'Interligação de Inox e Equipamentos'],
        },
        FORTYS: {
          tipoInput: 'xml_ms_project',
          escopos: ['Prédio (Estrutura Principal)'],
        },
      },
    },
    Elétrica: { habilitada: false, empresas: {} },
    Instrumentação: { habilitada: false, empresas: {} },
  },
  // Mesma estrutura de destilaria_fase_1 (Dashboard/Data_Base/Atualização/
  // Input), mas por enquanto só a FORTYS está habilitada aqui — a
  // QUALISOLDA ainda não tem escopo cadastrado pra Fase II (não mexer nisso
  // até ela ser configurada num próximo prompt).
  destilaria_fase_2: {
    Civil: { habilitada: false, empresas: {} },
    Metal: {
      habilitada: true,
      empresas: {
        FORTYS: {
          tipoInput: 'xml_ms_project',
          escopos: ['Prédio (Estrutura Principal)'],
        },
      },
    },
    Elétrica: { habilitada: false, empresas: {} },
    Instrumentação: { habilitada: false, empresas: {} },
  },
}

/** Config de disciplina dentro de uma fase, ou um objeto vazio "seguro" se a fase/disciplina ainda não existir no catálogo. */
export function configDisciplina(fase, disciplina) {
  return AVANCO_CONFIG[fase]?.[disciplina] ?? { habilitada: false, empresas: {} }
}

/** Escopos cadastrados pra uma empresa específica, dentro de uma disciplina/fase. */
export function escoposDaEmpresa(fase, disciplina, empresa) {
  return configDisciplina(fase, disciplina).empresas?.[empresa]?.escopos ?? []
}

/**
 * Todas as empresas cadastradas numa fase, em QUALQUER disciplina, cada
 * uma com sua disciplina de origem — usado no seletor de Empresa da aba
 * Data_Base (que não pede a disciplina antes, só a empresa).
 */
export function listarEmpresasDaFase(fase) {
  const disciplinas = AVANCO_CONFIG[fase] ?? {}
  const lista = []
  for (const [disciplina, config] of Object.entries(disciplinas)) {
    for (const empresa of Object.keys(config.empresas ?? {})) {
      lista.push({ empresa, disciplina })
    }
  }
  return lista.sort((a, b) => a.empresa.localeCompare(b.empresa, 'pt-BR'))
}

/** Disciplina + escopos + tipoInput de uma empresa, procurando em todas as disciplinas da fase (uma empresa pertence a uma única disciplina). */
export function buscarEmpresa(fase, empresa) {
  const disciplinas = AVANCO_CONFIG[fase] ?? {}
  for (const [disciplina, config] of Object.entries(disciplinas)) {
    const configEmpresa = config.empresas?.[empresa]
    if (configEmpresa) {
      return { disciplina, escopos: configEmpresa.escopos, tipoInput: configEmpresa.tipoInput }
    }
  }
  return null
}
