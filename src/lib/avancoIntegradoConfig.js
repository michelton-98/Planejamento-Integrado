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
export const FASES_AVANCO = [
  {
    chave: 'destilaria_fase_1',
    titulo: 'Destilaria Fase I',
    href: '/avanco-integrado/destilaria-fase-1',
    habilitada: true,
  },
  { chave: 'destilaria_fase_2', titulo: 'Destilaria Fase II', href: null, habilitada: false },
  { chave: 'clarificacao_oleo', titulo: 'Clarificação de Óleo', href: null, habilitada: false },
  { chave: 'extracao_oleo_fase_1', titulo: 'Extração de Óleo Fase I', href: null, habilitada: false },
  { chave: 'extracao_oleo_fase_2', titulo: 'Extração de Óleo Fase II', href: null, habilitada: false },
]

// As 4 disciplinas do checklist do Dashboard e dos cards da aba Input —
// mesma lista em todas as fases (mesmo que uma fase ainda não tenha
// nenhuma disciplina habilitada pra Input).
export const DISCIPLINAS_AVANCO = ['Civil', 'Metal', 'Elétrica', 'Instrumentação']

// Empresas -> escopos por disciplina, dentro de cada fase. Disciplina
// ausente aqui (ou com `empresas: {}`) = ainda sem nenhuma empresa
// cadastrada nessa fase (ver estado vazio do Dashboard/Data_Base).
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
        QUALISOLDA: [
          'Isométricos de Inox',
          'Isométricos de Carbono',
          'Mols',
          'Torres',
          'Bombas',
          'SIs',
          'Trocadores de Calor',
        ],
        FORTYS: ['Colunas', 'Nível +5000', 'Nível +10000', 'Nível +15000', 'Escadas', 'Plataformas'],
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
  return configDisciplina(fase, disciplina).empresas?.[empresa] ?? []
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

/** Disciplina + lista de escopos de uma empresa, procurando em todas as disciplinas da fase (uma empresa pertence a uma única disciplina). */
export function buscarEmpresa(fase, empresa) {
  const disciplinas = AVANCO_CONFIG[fase] ?? {}
  for (const [disciplina, config] of Object.entries(disciplinas)) {
    if (config.empresas?.[empresa]) {
      return { disciplina, escopos: config.empresas[empresa] }
    }
  }
  return null
}
