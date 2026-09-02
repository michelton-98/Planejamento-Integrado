import * as XLSX from 'xlsx'

// Extrai os dados de avanço dos 2 arquivos .xlsx semanais da QUALISOLDA
// (um por escopo — ver PARTES 1/2 do prompt original). Roda dentro de um
// Web Worker (ver src/workers/qualisoldaXlsxParser.worker.js e
// src/lib/qualisoldaXlsxWorkerClient.js, que sobe o worker), mas ao
// contrário do parsing da FORTYS (fortysXmlParse.js, que varre texto puro
// pra fugir de DOMParser — indisponível em Worker), aqui usamos a lib
// "xlsx" (SheetJS): ela lê o .xlsx (zip + XML interno) com o parser XML
// PRÓPRIO da lib, sem depender de DOMParser — funciona igual dentro e fora
// de Worker (testado passando pelo Worker real, não só a função isolada).
//
// Cada planilha é lida como matriz de linhas (XLSX.utils.sheet_to_json com
// `header: 1`), indexada por [linha0][coluna0] — coluna 0 = A, 1 = B, etc.
// (mesma convenção usada em toda leitura de célula abaixo).

export const SUPORTES_LABEL = { carbono: 'Suportes (Carbono)', inox: 'Suportes (Inox)' }

// Pesos fixos de ponderação entre Fabricação/Montagem/Pintura pro avanço
// total de Suportes — mesmos 30/65/5 usados na ponderação dos isométricos
// (ver colunas K/Q/T de "MC Tubulação AC"/"MC Tubulação INOX", que já vêm
// com esses pesos aplicados dentro do próprio arquivo).
const PESO_FABRICACAO = 0.3
const PESO_MONTAGEM = 0.65
const PESO_PINTURA = 0.05

const REGEX_ACENTOS_NFD = new RegExp('[̀-ͯ]', 'g')

function normalizar(texto) {
  return (texto ?? '')
    .toString()
    .normalize('NFD')
    .replace(REGEX_ACENTOS_NFD, '')
    .toUpperCase()
    .trim()
}

function paraNumero(valor) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (valor === null || valor === undefined || valor === '') return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

/** Converte uma fração (0–1, como vêm as colunas de % no arquivo) pra escala 0–100 usada no resto do app (ver formatarPercentualIndicador). */
function paraPercentual(valor) {
  const numero = paraNumero(valor)
  return numero === null ? null : numero * 100
}

function celula(linhas, linha, coluna) {
  return linhas[linha]?.[coluna]
}

function sheetParaLinhas(workbook, nomeAba, nomeArquivoParaErro) {
  const sheet = workbook.Sheets[nomeAba]
  if (!sheet) {
    throw new Error(`A planilha "${nomeAba}" não foi encontrada neste arquivo${nomeArquivoParaErro}. Confirme se é o arquivo certo.`)
  }
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: true })
}

/**
 * Acha dinamicamente a linha onde uma coluna bate exatamente (após
 * normalizar) com `alvoNormalizado`, a partir de `linhaInicial` — nunca por
 * número de linha fixo (arquivo cresce/encolhe toda semana). Devolve o
 * índice da linha (0-based) ou -1 se não encontrar.
 */
function encontrarLinha(linhas, coluna, alvoNormalizado, linhaInicial = 0) {
  for (let i = linhaInicial; i < linhas.length; i++) {
    if (normalizar(celula(linhas, i, coluna)) === alvoNormalizado) return i
  }
  return -1
}

// --- Sheet "MC Tubulação AC" / "MC Tubulação INOX" (isométricos) --------

const ITEM_START_ROW = 12 // linha 13 (1-indexed) — primeira linha de item real, sempre fixa (é o cabeçalho acima que muda de altura, não o início dos itens)

/**
 * Lê os itens de isométricos de "MC Tubulação AC" (Carbono) ou "MC
 * Tubulação INOX" (Inox) — para dinamicamente quando a coluna C bate com
 * "PESO LISTA MATERIAL" (linha de resumo, localizada por conteúdo).
 */
function lerIsometricos(linhas, { colArea, colIsometrico, colDiametro, colPesoTotal, colFab, colMont, colPint, colTotal, colPesoExecutado }) {
  const itens = []
  let linha = ITEM_START_ROW

  while (linha < linhas.length) {
    const isometrico = celula(linhas, linha, colIsometrico)
    if (normalizar(isometrico) === 'PESO LISTA MATERIAL') break

    // Linha totalmente vazia no meio da tabela (não deveria acontecer, mas
    // não trava o parsing por causa disso) — só pula.
    if (isometrico === null || isometrico === undefined || isometrico === '') {
      linha++
      continue
    }

    const pesoTotal = paraNumero(celula(linhas, linha, colPesoTotal))
    if (pesoTotal === null) {
      throw new Error(`Peso total ausente/inválido no isométrico "${isometrico}" (linha ${linha + 1}).`)
    }

    const percentualTotal = paraPercentual(celula(linhas, linha, colTotal))
    const pesoExecutado =
      colPesoExecutado !== undefined
        ? (paraNumero(celula(linhas, linha, colPesoExecutado)) ?? pesoTotal * ((percentualTotal ?? 0) / 100))
        : pesoTotal * ((percentualTotal ?? 0) / 100)

    itens.push({
      area: celula(linhas, linha, colArea) ?? null,
      isometrico: String(isometrico),
      diametro: paraNumero(celula(linhas, linha, colDiametro)),
      pesoTotal,
      percentualFabricacao: paraPercentual(celula(linhas, linha, colFab)),
      percentualMontagem: paraPercentual(celula(linhas, linha, colMont)),
      percentualPintura: paraPercentual(celula(linhas, linha, colPint)),
      percentualTotal,
      pesoExecutado,
    })

    linha++
  }

  if (linha >= linhas.length) {
    throw new Error('Não foi encontrada a linha "PESO LISTA MATERIAL" — não foi possível saber onde a lista de isométricos termina.')
  }

  return itens
}

// --- Sheet "MC Suportes" (mesma aba nos 2 arquivos) ----------------------

const COL_B_DESCRICAO = 1

/** Lê o resumo de Suportes de um material ("PREVISTO AC" ou "PREVISTO INOX", localizado dinamicamente pela coluna B). */
function lerResumoSuportes(linhas, material) {
  const rotuloLinha = material === 'carbono' ? 'PREVISTO AC' : 'PREVISTO INOX'
  const linha = encontrarLinha(linhas, COL_B_DESCRICAO, rotuloLinha)
  if (linha === -1) {
    throw new Error(`Não foi encontrada a linha "${rotuloLinha}" na planilha "MC Suportes".`)
  }

  const pesoTotal = paraNumero(celula(linhas, linha, 3)) // D
  const pesoListaMaterial = paraNumero(celula(linhas, linha, 6)) // G
  const fracFabricacao = paraNumero(celula(linhas, linha, 14)) // O
  const fracMontagem = paraNumero(celula(linhas, linha, 17)) // R
  const fracPintura = paraNumero(celula(linhas, linha, 20)) // U

  if (pesoTotal === null) {
    throw new Error(`Peso total (coluna D) ausente/inválido na linha "${rotuloLinha}" de "MC Suportes".`)
  }

  const fracTotal = PESO_FABRICACAO * (fracFabricacao ?? 0) + PESO_MONTAGEM * (fracMontagem ?? 0) + PESO_PINTURA * (fracPintura ?? 0)

  return {
    tipoRegistro: 'suporte_resumo',
    material,
    area: null,
    isometrico: SUPORTES_LABEL[material],
    diametro: null,
    pesoTotal,
    pesoListaMaterial,
    percentualFabricacao: fracFabricacao === null ? null : fracFabricacao * 100,
    percentualMontagem: fracMontagem === null ? null : fracMontagem * 100,
    percentualPintura: fracPintura === null ? null : fracPintura * 100,
    percentualTotal: fracTotal * 100,
    pesoExecutado: pesoTotal * fracTotal,
  }
}

// --- Validação de estrutura ------------------------------------------------

/** Lança erro claro (em vez de números errados) quando a célula de cabeçalho esperada não contém a palavra-chave — arquivo fora do formato esperado. */
function validarCabecalho(linhas, linha, coluna, palavraChave, descricaoColuna) {
  const valor = normalizar(celula(linhas, linha, coluna))
  if (!valor.includes(palavraChave)) {
    throw new Error(
      `Estrutura inesperada: a célula de cabeçalho de ${descricaoColuna} (linha ${linha + 1}) não contém "${palavraChave}". ` +
        'O layout deste arquivo mudou — confira antes de reenviar.',
    )
  }
}

// --- PARTE 1: Carbono ("Interligação de Carbono") -------------------------

const COLS_TUBULACAO_AC = {
  colArea: 1, // B
  colIsometrico: 2, // C
  colDiametro: 3, // D
  colPesoTotal: 4, // E
  colFab: 11, // L
  colMont: 16, // Q
  colPint: 19, // T
  colTotal: 20, // U
}

/**
 * Parse completo do escopo "Interligação de Carbono": sheets "MC Tubulação
 * AC" + "MC Suportes" (parte "PREVISTO AC"). Devolve os itens já no
 * formato pronto pra gravar em avanco_itens_tubulacao + o % avanço geral
 * do escopo (peso_executado ÷ peso_total, isométricos + Suportes).
 */
export function parseQualisoldaCarbono(workbook) {
  const linhasTub = sheetParaLinhas(workbook, 'MC Tubulação AC', ' (esperado o arquivo do escopo Interligação de Carbono)')
  validarCabecalho(linhasTub, 8, COLS_TUBULACAO_AC.colTotal, 'AVANC', 'coluna U (% avanço isométrico total)')

  const isometricos = lerIsometricos(linhasTub, COLS_TUBULACAO_AC).map((item) => ({
    tipoRegistro: 'isometrico',
    material: 'carbono',
    ...item,
  }))

  const linhasSuportes = sheetParaLinhas(workbook, 'MC Suportes', '')
  const suporte = lerResumoSuportes(linhasSuportes, 'carbono')

  const somaPesoTotal = isometricos.reduce((soma, item) => soma + item.pesoTotal, 0) + suporte.pesoTotal
  const somaPesoExecutado = isometricos.reduce((soma, item) => soma + item.pesoExecutado, 0) + suporte.pesoExecutado
  const percentualExecutadoGeral = somaPesoTotal > 0 ? (somaPesoExecutado / somaPesoTotal) * 100 : null

  return {
    itensTubulacao: [...isometricos, suporte],
    percentualExecutadoGeral,
    percentualEquipamentosGeral: null,
  }
}

// --- PARTE 2: Inox e Equipamentos ------------------------------------------

const COLS_TUBULACAO_INOX = {
  colArea: 1, // B
  colIsometrico: 2, // C
  colDiametro: 4, // E
  colPesoTotal: 5, // F
  colFab: 12, // M
  colMont: 17, // R
  colPint: undefined, // não existe coluna de % pintura na sheet INOX (só Fabricação/Montagem)
  colTotal: 18, // S
  colPesoExecutado: 19, // T — já vem calculada (F×S) no arquivo; prefere ler direto
}

const EQUIPAMENTOS_START_ROW = 13 // linha 14 (1-indexed)

/** Lê os itens de "MC Equipamentos" — para quando a coluna C (TAG) fica vazia (linha de totais). CONDENSADOR entra como EQUIPAMENTO (só existe 1 item assim hoje). */
function lerEquipamentos(linhas) {
  const itens = []
  let linha = EQUIPAMENTOS_START_ROW

  while (linha < linhas.length) {
    const tag = celula(linhas, linha, 2) // C
    if (tag === null || tag === undefined || tag === '') break

    const pesoTotal = paraNumero(celula(linhas, linha, 3)) // D
    if (pesoTotal === null) {
      throw new Error(`Peso total ausente/inválido no equipamento "${tag}" (linha ${linha + 1}).`)
    }

    const classificacaoBruta = normalizar(celula(linhas, linha, 12)) // M
    const classificacao = classificacaoBruta === 'CONDENSADOR' ? 'EQUIPAMENTO' : classificacaoBruta

    itens.push({
      tipoEquipamento: celula(linhas, linha, 1) ?? null, // B
      tag: String(tag),
      classificacao,
      pesoTotal,
      percentualIcamento: paraPercentual(celula(linhas, linha, 5)), // F
      percentualAlinhamento: paraPercentual(celula(linhas, linha, 7)), // H
      percentualFixacao: paraPercentual(celula(linhas, linha, 9)), // J
      percentualTotal: paraPercentual(celula(linhas, linha, 10)), // K
      pesoExecutado: paraNumero(celula(linhas, linha, 11)) ?? 0, // L
    })

    linha++
  }

  if (itens.length === 0) {
    throw new Error('Nenhum equipamento encontrado na planilha "MC Equipamentos" a partir da linha 14.')
  }

  return itens
}

/**
 * Parse completo do escopo "Interligação de Inox e Equipamentos": sheets
 * "MC Tubulação INOX" + "MC Suportes" (parte "PREVISTO INOX") pro % avanço
 * geral do escopo (SEM equipamentos), e "MC Equipamentos" pro % avanço de
 * Equipamentos à parte.
 */
export function parseQualisoldaInox(workbook) {
  const linhasTub = sheetParaLinhas(workbook, 'MC Tubulação INOX', ' (esperado o arquivo do escopo Interligação de Inox e Equipamentos)')
  validarCabecalho(linhasTub, 8, COLS_TUBULACAO_INOX.colTotal, 'AVANC', 'coluna S (% avanço isométrico total)')

  const isometricos = lerIsometricos(linhasTub, COLS_TUBULACAO_INOX).map((item) => ({
    tipoRegistro: 'isometrico',
    material: 'inox',
    ...item,
  }))

  const linhasSuportes = sheetParaLinhas(workbook, 'MC Suportes', '')
  const suporte = lerResumoSuportes(linhasSuportes, 'inox')

  const somaPesoTotal = isometricos.reduce((soma, item) => soma + item.pesoTotal, 0) + suporte.pesoTotal
  const somaPesoExecutado = isometricos.reduce((soma, item) => soma + item.pesoExecutado, 0) + suporte.pesoExecutado
  const percentualExecutadoGeral = somaPesoTotal > 0 ? (somaPesoExecutado / somaPesoTotal) * 100 : null

  const linhasEquip = sheetParaLinhas(workbook, 'MC Equipamentos', '')
  validarCabecalho(linhasEquip, 9, 10, 'AVANC', 'coluna K (% avanço total do equipamento)')
  const equipamentos = lerEquipamentos(linhasEquip)

  const somaPesoTotalEquip = equipamentos.reduce((soma, item) => soma + item.pesoTotal, 0)
  const somaPesoExecutadoEquip = equipamentos.reduce((soma, item) => soma + item.pesoExecutado, 0)
  const percentualEquipamentosGeral = somaPesoTotalEquip > 0 ? (somaPesoExecutadoEquip / somaPesoTotalEquip) * 100 : null

  return {
    itensTubulacao: [...isometricos, suporte],
    percentualExecutadoGeral,
    percentualEquipamentosGeral,
    equipamentos,
  }
}

/**
 * Ponto de entrada usado pelo worker: lê o arquivo (File/Blob) com a lib
 * "xlsx" e despacha pro parser certo conforme `escopoTipo`
 * ('carbono' | 'inox'). `escopoTipo` já vem decidido pela UI a partir do
 * escopo selecionado no formulário (ver AvancoInput.jsx) — não é
 * adivinhado a partir do conteúdo do arquivo.
 */
export async function parseQualisoldaXlsx(arquivo, escopoTipo) {
  const buffer = await arquivo.arrayBuffer()

  let workbook
  try {
    workbook = XLSX.read(buffer, { type: 'array' })
  } catch (erroOriginal) {
    console.error('Erro ao abrir XLSX da QUALISOLDA:', erroOriginal)
    throw new Error('Não foi possível abrir o arquivo .xlsx. Verifique se ele não está corrompido e se foi salvo em um formato Excel válido.')
  }

  if (escopoTipo === 'carbono') return parseQualisoldaCarbono(workbook)
  if (escopoTipo === 'inox') return parseQualisoldaInox(workbook)
  throw new Error(`Tipo de escopo desconhecido: "${escopoTipo}".`)
}
