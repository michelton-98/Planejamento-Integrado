import { supabase } from './supabaseClient'

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

/**
 * Série diária dos últimos `dias` dias (incluindo `dataReferencia`), com a
 * contagem de cada combinação status × prazo por data_relatorio. Dias sem
 * registros aparecem com contagem zero, para mostrar a evolução real.
 */
export function computeDailySeries(rows, dataReferencia = new Date(), dias = 15) {
  const hoje = inicioDoDiaLocal(dataReferencia)

  const porDia = new Map()
  for (let i = dias - 1; i >= 0; i--) {
    const data = new Date(hoje)
    data.setDate(data.getDate() - i)
    const { chave, label } = formatarDataLocal(data)
    porDia.set(chave, {
      data: chave,
      label,
      contratada_no_prazo: 0,
      contratada_atrasada: 0,
      especialista_no_prazo: 0,
      especialista_atrasada: 0,
    })
  }

  for (const row of rows) {
    const chave = toDateKey(row.data_relatorio)
    if (!chave || !porDia.has(chave)) continue

    const bucket = porDia.get(chave)
    const atrasado = estaAtrasado(row, hoje)

    if (row.status_aprovacao === 'pendente_contratada') {
      if (atrasado) bucket.contratada_atrasada += 1
      else bucket.contratada_no_prazo += 1
    } else if (row.status_aprovacao === 'pendente_especialista') {
      if (atrasado) bucket.especialista_atrasada += 1
      else bucket.especialista_no_prazo += 1
    }
  }

  return Array.from(porDia.values())
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
 * importadas; só o gráfico de evolução diária (computeDailySeries) é
 * recortado aos últimos `dias`. Não filtre `rows` por data antes de
 * chamar esta função.
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

// --- Ranking de termos de escopo em atraso --------------------------------

const PARADAS_ESCOPO = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'com',
  'em',
  'para',
  'a',
  'o',
  'as',
  'os',
  'no',
  'na',
  'nos',
  'nas',
  'ao',
  'aos',
  'um',
  'uma',
  'por',
])

// Divide o texto do escopo em termos normalizados (sem acento, minúsculo,
// só letras/números), descartando palavras muito curtas e as mais comuns
// ("de", "da", "e"...) que não carregam significado — uma aproximação
// simples e previsível de "tipo de escopo", sem exigir similaridade
// textual mais sofisticada.
function tokenizarEscopo(escopo) {
  return String(escopo ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((termo) => termo.length >= 3 && !PARADAS_ESCOPO.has(termo))
}

/**
 * Top termos (palavras) mais frequentes no campo `escopo` entre as
 * pendências ATRASADAS (qualquer estágio). Cada termo conta no máximo uma
 * vez por linha, mesmo que se repita no texto do escopo.
 */
export function computeRankingEscoposAtrasados(rows, dataReferencia = new Date(), limite = 10) {
  const atrasadas = rows.filter((row) => estaAtrasado(row, dataReferencia))
  const contagem = new Map()

  for (const row of atrasadas) {
    const termos = new Set(tokenizarEscopo(row.escopo))
    for (const termo of termos) {
      contagem.set(termo, (contagem.get(termo) ?? 0) + 1)
    }
  }

  return Array.from(contagem.entries())
    .map(([termo, total]) => ({ termo, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limite)
}

/**
 * Linhas ATRASADAS (mesmo universo do ranking acima) cujo escopo contém o
 * termo selecionado — para a tabela de detalhe ao clicar num item do
 * ranking.
 */
export function filtrarPorTermoEscopo(rows, termo, dataReferencia = new Date()) {
  return rows
    .filter((row) => estaAtrasado(row, dataReferencia))
    .filter((row) => tokenizarEscopo(row.escopo).includes(termo))
    .map((row) => ({
      numero_contrato: row.numero_contrato,
      data_relatorio: row.data_relatorio,
      escopo: row.escopo,
      empresa: row.empresa,
      responsavel_nome: row.responsavel_nome,
      status_aprovacao: row.status_aprovacao,
    }))
    .sort((a, b) => (a.data_relatorio < b.data_relatorio ? 1 : -1))
}
