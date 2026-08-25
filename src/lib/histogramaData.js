import { buildColumnMap, readRawRows, unwrapRow, validarArquivo } from './fileParsingUtils'
import { supabase } from './supabaseClient'

// Ferramenta "Histograma": efetivo de mão de obra (Previsto x Realizado x
// Projeção) por Empresa + Disciplina + Data de referência — tabela
// histograma_efetivo (ver migration 0023), independente do resto do
// sistema. Só guarda os dados já extraídos do .csv enviado, nunca o
// arquivo bruto (mesmo espírito da correção feita no Avanço Integrado da
// FORTYS, ver avancoIntegradoData.js).

// As 5 disciplinas válidas hoje. `tipo_mo` (ex.: "IMP") é gravado mas
// propositalmente NÃO usado como filtro/dimensão em nenhum lugar da
// ferramenta — linhas de tipos diferentes pra mesma Empresa+Disciplina+Data
// são somadas entre si em todo agregado (ver agruparEmpresaDisciplina).
export const DISCIPLINAS_HISTOGRAMA = [
  '01 - Civil',
  '02 - Mecânica',
  '03 - Instrumentação',
  '04 - Elétrica',
  '05 - Rotativo',
]

function normalizarComparacao(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

const DISCIPLINA_POR_CHAVE = new Map(
  DISCIPLINAS_HISTOGRAMA.map((disciplina) => [normalizarComparacao(disciplina), disciplina]),
)

// Colunas esperadas no .csv (ver anexo do prompt original): Empresa,
// Disciplina, Tipo MO, Previsto, Realizado, Projeção, Data Ref. — casadas
// pelo NOME do cabeçalho (normalizeKey já tolera acento/maiúscula-minúscula
// e ordinais), nunca pela posição da coluna.
const FIELD_ALIASES = {
  empresa: ['empresa'],
  disciplina: ['disciplina'],
  tipo_mo: ['tipo mo', 'tipo m.o.', 'tipo de mo'],
  previsto: ['previsto'],
  realizado: ['realizado'],
  projecao: ['projecao', 'projecao mo'],
  data_ref: ['data ref.', 'data ref', 'data referencia', 'data de referencia'],
}

// Converte um valor numérico tolerante a formatação pt-BR ("1.234", "23,5")
// pra inteiro (Math.round) — campos previsto/realizado/projecao são sempre
// contagem de efetivo (pessoas), nunca fração. Vazio/inválido -> null (não
// 0 — "sem informação" é diferente de "zero pessoas").
function parseInteiroTolerante(valor) {
  const texto = String(valor ?? '').trim()
  if (!texto) return null

  // "1.234,5" (milhar com ponto + decimal com vírgula) -> "1234.5"; sem
  // vírgula, o ponto também é tratado como separador de milhar ("1.234"
  // -> "1234"), já que estes campos nunca têm casas decimais na prática.
  const semMilhar = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto.replace(/\./g, '')
  const numero = Number(semMilhar)
  if (!Number.isFinite(numero)) return null
  return Math.round(numero)
}

// "DD/MM/AAAA" ou "AAAA-MM-DD" -> 'YYYY-MM-DD'; qualquer outro formato
// (ou vazio) -> null, sem bloquear o parse (a Data Ref. do arquivo é só um
// aviso de conferência, nunca a fonte de verdade — ver enviarHistogramaEfetivo).
function parseDataRefArquivo(valor) {
  const texto = String(valor ?? '').trim()
  if (!texto) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto

  const matchBr = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (matchBr) {
    const [, dia, mes, ano] = matchBr
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
  }

  return null
}

/**
 * Lê o .csv de efetivo e retorna as linhas tratadas + a Data Ref. mais
 * comum encontrada no arquivo (pra comparar com a data escolhida na tela,
 * ver HistogramaInput.jsx — só um aviso, nunca bloqueia o envio).
 */
export async function parseHistogramaFile(file) {
  validarArquivo(file)

  const linhasBrutas = await readRawRows(file)
  if (!linhasBrutas.length) {
    throw new Error('O arquivo não contém linhas de dados.')
  }

  const rawRows = linhasBrutas.map(unwrapRow)
  const { columnMap, faltando } = buildColumnMap(rawRows[0], FIELD_ALIASES)

  // Data Ref. é só um aviso de conferência (ver parseDataRefArquivo) — não
  // é obrigatória pro parse funcionar, então não entra na checagem de
  // colunas faltando.
  const faltandoObrigatorias = faltando.filter((alias) => alias !== FIELD_ALIASES.data_ref[0])
  if (faltandoObrigatorias.length) {
    throw new Error(`Colunas esperadas não encontradas no arquivo: ${faltandoObrigatorias.join(', ')}.`)
  }

  const contagemDataRef = new Map()

  const linhas = rawRows.map((raw, index) => {
    const empresa = String(raw[columnMap.empresa] ?? '').trim()
    const disciplinaOriginal = String(raw[columnMap.disciplina] ?? '').trim()
    const disciplina = DISCIPLINA_POR_CHAVE.get(normalizarComparacao(disciplinaOriginal)) ?? disciplinaOriginal
    const disciplinaReconhecida = DISCIPLINA_POR_CHAVE.has(normalizarComparacao(disciplinaOriginal))
    const tipo_mo = columnMap.tipo_mo ? String(raw[columnMap.tipo_mo] ?? '').trim() || null : null
    const dataRefArquivo = columnMap.data_ref ? parseDataRefArquivo(raw[columnMap.data_ref]) : null

    if (dataRefArquivo) {
      contagemDataRef.set(dataRefArquivo, (contagemDataRef.get(dataRefArquivo) ?? 0) + 1)
    }

    let erro = null
    if (!empresa) erro = 'Coluna "Empresa" vazia.'
    else if (!disciplinaOriginal) erro = 'Coluna "Disciplina" vazia.'

    return {
      linha: index + 2, // linha 1 = cabeçalho
      empresa,
      disciplina,
      disciplinaReconhecida,
      tipo_mo,
      previsto: parseInteiroTolerante(raw[columnMap.previsto]),
      realizado: parseInteiroTolerante(raw[columnMap.realizado]),
      projecao: parseInteiroTolerante(raw[columnMap.projecao]),
      dataRefArquivo,
      erro,
    }
  })

  let dataRefMaisComum = null
  let maiorContagem = 0
  for (const [data, contagem] of contagemDataRef) {
    if (contagem > maiorContagem) {
      maiorContagem = contagem
      dataRefMaisComum = data
    }
  }

  return { linhas, dataRefMaisComum }
}

/** Todas as datas de referência já cadastradas, sem repetição, mais recente primeiro. */
export async function fetchDatasHistograma() {
  const { data, error } = await supabase
    .from('histograma_efetivo')
    .select('data_referencia')
    .order('data_referencia', { ascending: false })

  if (error) throw error
  return Array.from(new Set((data ?? []).map((item) => item.data_referencia)))
}

/** Linhas cadastradas pra UMA data de referência exata — usado pelo quadro de conferência da aba Input. */
export async function fetchHistogramaPorData(dataReferencia) {
  if (!dataReferencia) return []
  const { data, error } = await supabase
    .from('histograma_efetivo')
    .select('*')
    .eq('data_referencia', dataReferencia)
    .order('empresa', { ascending: true })

  if (error) throw error
  return data ?? []
}

/** TODAS as linhas já cadastradas, de todas as datas — base da aba Dashboard (curva histórica etc.). */
export async function fetchTodoHistograma() {
  const { data, error } = await supabase
    .from('histograma_efetivo')
    .select('*')
    .order('data_referencia', { ascending: true })

  if (error) throw error
  return data ?? []
}

/**
 * Envia um novo snapshot de efetivo pra `dataReferencia`: apaga TODAS as
 * linhas já cadastradas pra essa data específica e insere as novas linhas
 * do .csv — reenviar a mesma data SUBSTITUI o snapshot inteiro dela; outras
 * datas continuam intactas (é assim que a curva histórica se forma).
 */
export async function enviarHistogramaEfetivo({ dataReferencia, linhas, user, profile }) {
  const { error: erroDelete } = await supabase
    .from('histograma_efetivo')
    .delete()
    .eq('data_referencia', dataReferencia)
  if (erroDelete) throw erroDelete

  const payload = linhas.map((linha) => ({
    data_referencia: dataReferencia,
    empresa: linha.empresa,
    disciplina: linha.disciplina,
    tipo_mo: linha.tipo_mo,
    previsto: linha.previsto,
    realizado: linha.realizado,
    projecao: linha.projecao,
    enviado_por: user?.id ?? null,
    enviado_por_nome: profile?.nome || null,
    enviado_por_email: user?.email || null,
  }))

  if (payload.length === 0) return []

  const { data, error } = await supabase.from('histograma_efetivo').insert(payload).select()
  if (error) throw error
  return data ?? []
}

// --- Agregações do Dashboard ---------------------------------------------

/** Data de referência mais recente presente em `linhas` (string 'YYYY-MM-DD'), ou null se vazio. */
export function dataMaisRecente(linhas) {
  return linhas.reduce((maisRecente, linha) => {
    if (!maisRecente || linha.data_referencia > maisRecente) return linha.data_referencia
    return maisRecente
  }, null)
}

/** Todas as datas de referência distintas em `linhas`, em ordem cronológica — eixo X da curva. */
export function datasOrdenadas(linhas) {
  return Array.from(new Set(linhas.map((linha) => linha.data_referencia))).sort()
}

/**
 * KPIs gerais da data de referência mais recente: Previsto/Realizado/
 * Projeção somados entre TODAS as empresas/disciplinas + Índice de
 * Aderência Geral (%) = Realizado ÷ Previsto. `previsto === 0` cai em
 * aderência 0 (evita divisão por zero antes de ter dados de verdade).
 */
export function kpisGerais(linhasDataMaisRecente) {
  const previsto = linhasDataMaisRecente.reduce((soma, linha) => soma + (linha.previsto ?? 0), 0)
  const realizado = linhasDataMaisRecente.reduce((soma, linha) => soma + (linha.realizado ?? 0), 0)
  const projecao = linhasDataMaisRecente.reduce((soma, linha) => soma + (linha.projecao ?? 0), 0)
  const aderencia = previsto > 0 ? Math.round((realizado / previsto) * 100) : 0
  return { previsto, realizado, projecao, aderencia }
}

/**
 * Curva ao longo do tempo: Previsto/Realizado/Projeção somados entre TODAS
 * as empresas/disciplinas, um ponto por Data Ref. já cadastrada (ordem
 * cronológica) — série pro gráfico de linha da aba Dashboard.
 */
export function curvaTemporal(linhas) {
  return datasOrdenadas(linhas).map((data) => {
    const linhasData = linhas.filter((linha) => linha.data_referencia === data)
    return {
      data,
      previsto: linhasData.reduce((soma, linha) => soma + (linha.previsto ?? 0), 0),
      realizado: linhasData.reduce((soma, linha) => soma + (linha.realizado ?? 0), 0),
      projecao: linhasData.reduce((soma, linha) => soma + (linha.projecao ?? 0), 0),
    }
  })
}

/**
 * Previsto x Realizado por disciplina, somado entre empresas, na data
 * informada — sempre as 5 disciplinas fixas (0 quando nenhum registro),
 * na ordem de DISCIPLINAS_HISTOGRAMA.
 */
export function porDisciplina(linhasDataMaisRecente) {
  return DISCIPLINAS_HISTOGRAMA.map((disciplina) => {
    const linhasDisciplina = linhasDataMaisRecente.filter((linha) => linha.disciplina === disciplina)
    return {
      disciplina,
      previsto: linhasDisciplina.reduce((soma, linha) => soma + (linha.previsto ?? 0), 0),
      realizado: linhasDisciplina.reduce((soma, linha) => soma + (linha.realizado ?? 0), 0),
    }
  })
}

/**
 * Agrupa as linhas de uma data por Empresa + Disciplina, somando
 * previsto/realizado/projecao — junta linhas que só diferem por
 * `tipo_mo` (não usado como dimensão, ver comentário de
 * DISCIPLINAS_HISTOGRAMA acima). Base do ranking de aderência.
 */
export function agruparEmpresaDisciplina(linhasDataMaisRecente) {
  const mapa = new Map()

  for (const linha of linhasDataMaisRecente) {
    const chave = `${linha.empresa}|${linha.disciplina}`
    const atual = mapa.get(chave) ?? {
      empresa: linha.empresa,
      disciplina: linha.disciplina,
      previsto: 0,
      realizado: 0,
      projecao: 0,
    }
    atual.previsto += linha.previsto ?? 0
    atual.realizado += linha.realizado ?? 0
    atual.projecao += linha.projecao ?? 0
    mapa.set(chave, atual)
  }

  return Array.from(mapa.values())
}

/**
 * Ranking de aderência (Realizado ÷ Previsto) por Empresa + Disciplina na
 * data mais recente, pior aderência primeiro — mesmo espírito visual dos
 * "Top 5" do Controle de RDO (ver TopBarChart.jsx). Só entram combinações
 * com Previsto > 0 (sem baseline não dá pra calcular % de aderência).
 */
export function rankingAderencia(linhasDataMaisRecente) {
  return agruparEmpresaDisciplina(linhasDataMaisRecente)
    .filter((item) => item.previsto > 0)
    .map((item) => ({ ...item, aderencia: Math.round((item.realizado / item.previsto) * 100) }))
    .sort((a, b) => a.aderencia - b.aderencia)
}
