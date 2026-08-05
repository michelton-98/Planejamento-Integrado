import { supabase } from './supabaseClient'
import { construirIndiceObras, encontrarObraCorrespondente } from './obraMatching'

/**
 * Busca as colunas de rdo_relatorios usadas pelo dashboard. Toda a
 * agregação (contagens, séries, top N) é feita no cliente a partir desse
 * conjunto de linhas — ver funções computeX abaixo.
 */
export async function fetchRdoRelatorios() {
  const { data, error } = await supabase
    .from('rdo_relatorios')
    .select(
      'id, data_relatorio, empresa, escopo, numero_contrato, status_aprovacao, responsavel_nome, criado_em',
    )

  if (error) throw error
  return data ?? []
}

const STATUS_OBRA_PADRAO = 'Obra em Andamento'

/**
 * Anexa `status_obra`, `disciplina` e o `numero_contrato` atual a cada
 * RDO, cruzando com `obras_escopos` por empresa+escopo (ver
 * obraMatching.js — numero_contrato nunca é critério de busca, só dado
 * exibido). RDOs sem obra correspondente cadastrada recebem
 * `status_obra: 'Obra em Andamento'` por padrão (nunca são descartados
 * silenciosamente), `disciplina: null` e mantêm o `numero_contrato`
 * gravado no próprio RDO (melhor do que não mostrar nada).
 *
 * O `numero_contrato` sempre reflete o valor atual da obra cadastrada —
 * não o que foi gravado em rdo_relatorios no momento da importação — para
 * que editar o contrato de uma obra já cadastrada atualize a exibição em
 * todo o sistema (explorador, pendências por disciplina, PDF) sem precisar
 * reimportar nada.
 */
export function anexarStatusObra(rows, obras) {
  const indice = construirIndiceObras(obras)

  return rows.map((row) => {
    const obra = encontrarObraCorrespondente(row, indice)
    return {
      ...row,
      numero_contrato: obra?.numero_contrato ?? row.numero_contrato ?? null,
      status_obra: obra?.status ?? STATUS_OBRA_PADRAO,
      disciplina: obra?.disciplina ?? null,
    }
  })
}

/**
 * Filtra os RDOs cuja obra correspondente está "Obra em Andamento" — o
 * universo usado por TODOS os cálculos do dashboard (cards, gráficos,
 * explorador, ranking por disciplina). Obras "Concluída", "não iniciada"
 * ou "Paralisada" não contam como pendência.
 */
export function filtrarRdosEmAndamento(rows, obras) {
  return anexarStatusObra(rows, obras).filter((row) => row.status_obra === STATUS_OBRA_PADRAO)
}

export function computeUltimaAtualizacao(rows) {
  return rows.reduce((max, row) => {
    if (!row.criado_em) return max
    return !max || row.criado_em > max ? row.criado_em : max
  }, null)
}

export function computeStats(rows, dataReferencia = new Date()) {
  const total = rows.length
  const pendenteContratada = rows.filter(
    (row) => row.status_aprovacao === 'pendente_contratada',
  ).length
  const pendenteEspecialista = rows.filter(
    (row) => row.status_aprovacao === 'pendente_especialista',
  ).length
  const atrasadas = rows.filter((row) => estaAtrasado(row, dataReferencia)).length
  const empresas = new Set(rows.map((row) => row.empresa).filter(Boolean))

  return {
    total,
    pendenteContratada,
    pendenteEspecialista,
    atrasadas,
    totalEmpresas: empresas.size,
  }
}

// --- Datas: helpers locais (evita toISOString, que é baseada em UTC e pode
// deslocar o dia em fusos a leste de UTC) --------------------------------

function toDateKey(valor) {
  // data_relatorio vem do Postgres como "YYYY-MM-DD".
  return typeof valor === 'string' ? valor.slice(0, 10) : null
}

function formatarDataLocal(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return { chave: `${ano}-${mes}-${dia}`, label: `${dia}/${mes}` }
}

/** Início do dia (00:00 local) de uma data ou string "YYYY-MM-DD"/ISO. */
export function inicioDoDiaLocal(valor) {
  if (valor instanceof Date) {
    const data = new Date(valor)
    data.setHours(0, 0, 0, 0)
    return data
  }

  const chave = toDateKey(valor) ?? String(valor ?? '').slice(0, 10)
  const partes = chave.split('-').map(Number)
  if (partes.length !== 3 || partes.some((n) => Number.isNaN(n))) return null

  const [ano, mes, dia] = partes
  return new Date(ano, mes - 1, dia)
}

// --- Regra de atraso ------------------------------------------------------

/**
 * Conta os dias úteis (segunda a sexta) estritamente após `dataInicio` até
 * `dataFim`, inclusive. Fins de semana são ignorados. Retorna 0 se
 * `dataFim` for igual ou anterior a `dataInicio`.
 */
export function contarDiasUteisEntre(dataInicio, dataFim) {
  const inicio = inicioDoDiaLocal(dataInicio)
  const fim = inicioDoDiaLocal(dataFim)
  if (!inicio || !fim || fim <= inicio) return 0

  let diasUteis = 0
  const cursor = new Date(inicio)
  cursor.setDate(cursor.getDate() + 1)

  while (cursor <= fim) {
    const diaDaSemana = cursor.getDay() // 0 = domingo, 6 = sábado
    if (diaDaSemana !== 0 && diaDaSemana !== 6) diasUteis += 1
    cursor.setDate(cursor.getDate() + 1)
  }

  return diasUteis
}

const LIMITE_DIAS_UTEIS_SEM_ATRASO = 2

/**
 * Classifica uma pendência como "atrasado" ou "no_prazo" com base em
 * quantos dias úteis se passaram entre `dataRelatorio` e `dataReferencia`
 * (hoje, por padrão). Mais de 2 dias úteis = atrasado. Função única e
 * reutilizada por toda a lógica do dashboard que depende de prazo.
 */
export function calcularStatusPrazo(dataRelatorio, dataReferencia = new Date()) {
  const diasUteis = contarDiasUteisEntre(dataRelatorio, dataReferencia)
  return diasUteis > LIMITE_DIAS_UTEIS_SEM_ATRASO ? 'atrasado' : 'no_prazo'
}

function estaAtrasado(row, dataReferencia) {
  return calcularStatusPrazo(row.data_relatorio, dataReferencia) === 'atrasado'
}

function groupByCount(rows, campo) {
  const contagem = new Map()
  for (const row of rows) {
    const valor = row[campo]
    if (!valor) continue
    contagem.set(valor, (contagem.get(valor) ?? 0) + 1)
  }

  return Array.from(contagem.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
}

const CAMPO_POR_TIPO = {
  contratada: 'empresa',
  especialista: 'responsavel_nome',
}

// Tanto os gráficos Top 5 quanto o explorador interativo são por estágio:
// "contratada" só olha linhas ainda pendentes da contratada, "especialista"
// só linhas já na etapa do especialista. Sem esse filtro, um responsável de
// um estágio podia aparecer contado no outro (ex.: um nome de contratada
// entrando no Top 5 de especialistas).
const STATUS_POR_TIPO = {
  contratada: 'pendente_contratada',
  especialista: 'pendente_especialista',
}

function linhasDoTipo(rows, tipo) {
  const status = STATUS_POR_TIPO[tipo]
  return rows.filter((row) => row.status_aprovacao === status)
}

/** Top empresas por contagem de pendências ATRASADAS, restrito a status_aprovacao = pendente_contratada. */
export function computeTopEmpresas(rows, dataReferencia = new Date(), limite = 5) {
  const linhas = linhasDoTipo(rows, 'contratada').filter((row) => estaAtrasado(row, dataReferencia))
  return groupByCount(linhas, 'empresa').slice(0, limite)
}

/** Top especialistas por contagem de pendências ATRASADAS, restrito a status_aprovacao = pendente_especialista. */
export function computeTopEspecialistas(rows, dataReferencia = new Date(), limite = 5) {
  const linhas = linhasDoTipo(rows, 'especialista').filter((row) => estaAtrasado(row, dataReferencia))
  return groupByCount(linhas, 'responsavel_nome').slice(0, limite)
}

/**
 * Lista de nomes (empresas ou especialistas) com sua contagem de
 * pendências, restrita ao estágio do tipo escolhido — e a NENHUMA janela
 * de data. O explorador de pendências considera TODAS as datas já
 * importadas. Não filtre `rows` por data antes de chamar esta função.
 */
export function computeNomesComContagem(rows, tipo) {
  return groupByCount(linhasDoTipo(rows, tipo), CAMPO_POR_TIPO[tipo])
}

/**
 * Linhas de detalhe para um nome selecionado no explorador interativo
 * (também sem janela de data — mesma observação acima),
 * restritas ao mesmo estágio (status_aprovacao) do tipo escolhido. `outro`
 * é o especialista (quando tipo = contratada) ou a contratada (quando
 * tipo = especialista); `prazo` é "atrasado" ou "no_prazo" via
 * calcularStatusPrazo — usados nas últimas colunas da tabela de detalhe.
 */
export function filtrarPorNome(rows, tipo, nome, dataReferencia = new Date()) {
  const campo = CAMPO_POR_TIPO[tipo]
  const campoOutro = tipo === 'contratada' ? 'responsavel_nome' : 'empresa'

  return linhasDoTipo(rows, tipo)
    .filter((row) => row[campo] === nome)
    .map((row) => ({
      escopo: row.escopo,
      data_relatorio: row.data_relatorio,
      numero_contrato: row.numero_contrato,
      prazo: calcularStatusPrazo(row.data_relatorio, dataReferencia),
      outro: row[campoOutro],
    }))
    .sort((a, b) => (a.data_relatorio < b.data_relatorio ? 1 : -1))
}

// --- Heatmap de volume diário ---------------------------------------------

/**
 * Dias (incluindo semanas incompletas de preenchimento) para montar um
 * heatmap estilo "contribuições do GitHub" com `dias` de janela (padrão
 * ~90 dias / 3 meses) terminando em `dataReferencia`. O início é alinhado
 * ao domingo da semana correspondente para fechar colunas de 7 dias
 * completas; dias de preenchimento fora da janela real vêm marcados com
 * `dentroDoIntervalo: false` (não contam, não são clicáveis). A contagem é
 * por `data_relatorio` — o mesmo campo de data usado no resto do
 * dashboard.
 */
export function computeHeatmapDias(rows, dataReferencia = new Date(), dias = 90) {
  const hoje = inicioDoDiaLocal(dataReferencia)

  const contagemPorDia = new Map()
  for (const row of rows) {
    const chave = toDateKey(row.data_relatorio)
    if (!chave) continue
    contagemPorDia.set(chave, (contagemPorDia.get(chave) ?? 0) + 1)
  }

  const inicioJanela = new Date(hoje)
  inicioJanela.setDate(inicioJanela.getDate() - (dias - 1))

  const inicioGrade = new Date(inicioJanela)
  inicioGrade.setDate(inicioGrade.getDate() - inicioGrade.getDay()) // volta ao domingo

  const resultado = []
  const cursor = new Date(inicioGrade)
  while (cursor <= hoje) {
    const { chave } = formatarDataLocal(cursor)
    resultado.push({
      data: chave,
      diaSemana: cursor.getDay(),
      mes: cursor.getMonth(),
      dentroDoIntervalo: cursor >= inicioJanela,
      contagem: contagemPorDia.get(chave) ?? 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return resultado
}

/** Nível (0–4) de intensidade de cor no heatmap, relativo ao maior valor do período. */
export function nivelHeatmap(contagem, maxContagem) {
  if (!contagem || maxContagem <= 0) return 0
  const proporcao = contagem / maxContagem
  if (proporcao <= 0.25) return 1
  if (proporcao <= 0.5) return 2
  if (proporcao <= 0.75) return 3
  return 4
}

/** Linhas de rdo_relatorios cuja data_relatorio é exatamente `data` ("YYYY-MM-DD"). */
export function filtrarPorData(rows, data) {
  return rows.filter((row) => toDateKey(row.data_relatorio) === data)
}

// --- Pendências por disciplina ---------------------------------------------

// Ordem fixa de exibição — disciplinas com contagem zero "afundam" pro
// final da lista (ver computePendenciasPorDisciplina), mas entre as que
// têm pendência a ordem abaixo é sempre respeitada.
export const ORDEM_DISCIPLINAS = [
  'Civil',
  'Metal',
  'Elétrica',
  'Instrumentação',
  'Rotativos',
  'Qualidade',
]

/**
 * Quantidade de pendências (RDOs) por disciplina, já restrita ao universo
 * de obras "em andamento" (rows deve vir de filtrarRdosEmAndamento). RDOs
 * sem disciplina cadastrada na obra correspondente não entram em nenhum
 * balde. Disciplinas com total zero saem da ordem fixa e vão para o fim
 * da lista (mantendo a ordem fixa entre si).
 */
export function computePendenciasPorDisciplina(rows) {
  const contagem = new Map(ORDEM_DISCIPLINAS.map((disciplina) => [disciplina, 0]))

  for (const row of rows) {
    if (row.disciplina && contagem.has(row.disciplina)) {
      contagem.set(row.disciplina, contagem.get(row.disciplina) + 1)
    }
  }

  return ORDEM_DISCIPLINAS.map((disciplina, ordem) => ({
    disciplina,
    total: contagem.get(disciplina),
    ordem,
  })).sort((a, b) => {
    const aZero = a.total === 0
    const bZero = b.total === 0
    if (aZero !== bZero) return aZero ? 1 : -1
    return a.ordem - b.ordem
  })
}

/**
 * Linhas de detalhe (mesmo universo "em andamento") de uma disciplina
 * selecionada — para a tabela ao clicar num item da lista.
 */
export function filtrarPorDisciplina(rows, disciplina, dataReferencia = new Date()) {
  return rows
    .filter((row) => row.disciplina === disciplina)
    .map((row) => ({
      numero_contrato: row.numero_contrato,
      data_relatorio: row.data_relatorio,
      escopo: row.escopo,
      empresa: row.empresa,
      responsavel_nome: row.responsavel_nome,
      status_aprovacao: row.status_aprovacao,
      prazo: calcularStatusPrazo(row.data_relatorio, dataReferencia),
    }))
    .sort((a, b) => (a.data_relatorio < b.data_relatorio ? 1 : -1))
}
