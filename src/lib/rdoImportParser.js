import Papa from 'papaparse'
import * as XLSX from 'xlsx'

// Campos que o arquivo precisa conter (por alias normalizado) para o parsing
// funcionar.
const FIELD_ALIASES = {
  obra: ['obra'],
  aprovacoes: ['aprovacoes', 'aprovacao'],
  responsavel: ['aguardando aprovacao de', 'aguardando aprovacaode'],
  data: ['data do relatorio', 'data relatorio', 'data'],
  numero: ['n', 'no', 'numero', 'numero rdo', 'numero do rdo'],
}

// Remove acentos, ordinais ("°"/"º") e normaliza espaços/caixa para
// comparar nomes de coluna sem depender de grafia exata.
function normalizeKey(key) {
  return String(key)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[°ºª]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

// Algumas plataformas exportam CSV "forçando texto" em cada célula com a
// sintaxe de fórmula do Excel ="valor" — usada para impedir que o Excel
// reinterprete datas, números com zero à esquerda etc. ao abrir o arquivo.
// Depois que o CSV já foi separado em campos, cada valor chega como a
// string literal ="valor" (com "" internas representando um " literal,
// mesma convenção de escape do Excel). Remove esse invólucro antes de
// aplicar as regras de negócio.
function unwrapExcelForcedText(valor) {
  if (typeof valor !== 'string') return valor
  const match = valor.match(/^="([\s\S]*)"$/)
  if (!match) return valor
  return match[1].replace(/""/g, '"')
}

// Aplica o "desembrulho" acima em todas as chaves e valores de uma linha.
function unwrapRow(row) {
  const limpo = {}
  for (const [chave, valor] of Object.entries(row)) {
    limpo[unwrapExcelForcedText(chave)] = unwrapExcelForcedText(valor)
  }
  return limpo
}

function buildColumnMap(sampleRow) {
  const normalizedToOriginal = new Map()
  Object.keys(sampleRow).forEach((originalKey) => {
    normalizedToOriginal.set(normalizeKey(originalKey), originalKey)
  })

  const columnMap = {}
  const faltando = []

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const alias = aliases.find((candidate) => normalizedToOriginal.has(candidate))
    if (alias) {
      columnMap[field] = normalizedToOriginal.get(alias)
    } else {
      faltando.push(aliases[0])
    }
  }

  return { columnMap, faltando }
}

const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024 // 15 MB

const MENSAGEM_CSV_ILEGIVEL =
  'Não foi possível interpretar o arquivo CSV. Verifique se ele não está corrompido e se as ' +
  'colunas estão separadas por vírgula ( , ) ou ponto e vírgula ( ; ).'

// Lê o arquivo como bytes e decodifica como UTF-8; se os bytes não forem
// UTF-8 válido, cai para windows-1252 (superset de ISO-8859-1/latin-1;
// é o que o Excel realmente usa ao salvar CSV em PT-BR no Windows).
async function decodeCsvText(file) {
  let buffer
  try {
    buffer = await file.arrayBuffer()
  } catch (erroOriginal) {
    console.error('Erro ao ler bytes do arquivo:', erroOriginal)
    throw new Error('Não foi possível ler o arquivo. Tente selecioná-lo novamente.')
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

async function readRawRows(file) {
  const name = file.name.toLowerCase()

  if (name.endsWith('.csv')) {
    const text = await decodeCsvText(file)

    let result
    try {
      // Sem "delimiter" definido, o PapaParse detecta automaticamente entre
      // "," ";" "\t" "|".
      result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      })
    } catch (erroOriginal) {
      console.error('Erro ao interpretar CSV:', erroOriginal)
      throw new Error(MENSAGEM_CSV_ILEGIVEL)
    }

    if (!result.data.length) {
      throw new Error(MENSAGEM_CSV_ILEGIVEL)
    }

    return result.data
  }

  if (name.endsWith('.xlsx')) {
    const buffer = await file.arrayBuffer()

    let workbook
    try {
      workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    } catch (erroOriginal) {
      console.error('Erro ao abrir XLSX:', erroOriginal)
      throw new Error(
        'Não foi possível abrir o arquivo .xlsx. Verifique se ele não está corrompido e se foi ' +
          'salvo em um formato Excel válido.',
      )
    }

    const nomeAba = workbook.SheetNames?.[0]
    const sheet = nomeAba ? workbook.Sheets[nomeAba] : null

    if (!sheet) {
      throw new Error('O arquivo .xlsx não contém nenhuma planilha.')
    }

    try {
      return XLSX.utils.sheet_to_json(sheet, { defval: '' })
    } catch (erroOriginal) {
      console.error('Erro ao ler linhas do XLSX:', erroOriginal)
      throw new Error(
        'Não foi possível ler os dados da planilha. Verifique se o arquivo não está corrompido.',
      )
    }
  }

  throw new Error('Formato de arquivo não suportado. Envie um arquivo .csv ou .xlsx.')
}

// Algumas obras vêm com o número do contrato antes da empresa, no formato
// "CT <número> - EMPRESA - ESCOPO". Quando esse prefixo existe, o número do
// contrato é extraído à parte e o restante ("EMPRESA - ESCOPO") segue a
// mesma regra de sempre (split no primeiro "-").
const PREFIXO_CONTRATO_REGEX = /^ct\s*(\d+)\s*-\s*/i

function parseObra(valor) {
  const textoOriginal = String(valor ?? '').trim()
  if (!textoOriginal) {
    return { empresa: '', escopo: '', numero_contrato: null, erro: 'Coluna "Obra" vazia.' }
  }

  const matchContrato = textoOriginal.match(PREFIXO_CONTRATO_REGEX)
  const numero_contrato = matchContrato ? matchContrato[1] : null
  const texto = matchContrato ? textoOriginal.slice(matchContrato[0].length).trim() : textoOriginal

  if (!texto) {
    return {
      empresa: '',
      escopo: '',
      numero_contrato,
      erro: 'Formato "EMPRESA - ESCOPO" não encontrado em "Obra".',
    }
  }

  const idx = texto.indexOf('-')
  if (idx === -1) {
    return {
      empresa: texto,
      escopo: '',
      numero_contrato,
      erro: 'Formato "EMPRESA - ESCOPO" não encontrado em "Obra".',
    }
  }

  const empresa = texto.slice(0, idx).trim()
  const escopo = texto.slice(idx + 1).trim()

  if (!empresa || !escopo) {
    return {
      empresa,
      escopo,
      numero_contrato,
      erro: 'Empresa ou escopo vazio após separar "Obra".',
    }
  }

  return { empresa, escopo, numero_contrato, erro: null }
}

function parseAprovacoes(valor) {
  const texto = String(valor ?? '').trim()

  if (texto.startsWith('1')) {
    return { status_aprovacao: 'pendente_contratada', erro: null }
  }
  if (texto.startsWith('2')) {
    return { status_aprovacao: 'pendente_especialista', erro: null }
  }

  return {
    status_aprovacao: null,
    erro: `Valor de "Aprovações" não reconhecido: "${valor}".`,
  }
}

const EMAIL_REGEX = /\S+@\S+\.\S+/

function parseResponsavel(valor) {
  const texto = String(valor ?? '').trim()
  const match = texto.match(/^(.*?)\(([^()]+)\)\s*$/)

  if (!match) {
    return {
      responsavel_nome: texto,
      responsavel_email: '',
      erro: 'Formato "Nome (email)" não encontrado em "Aguardando aprovação de".',
    }
  }

  const nome = match[1].trim()
  const email = match[2].trim()

  if (!nome || !EMAIL_REGEX.test(email)) {
    return {
      responsavel_nome: nome,
      responsavel_email: email,
      erro: 'Nome ou e-mail inválido em "Aguardando aprovação de".',
    }
  }

  return { responsavel_nome: nome, responsavel_email: email, erro: null }
}

function pad2(numero) {
  return String(numero).padStart(2, '0')
}

// Excel guarda datas como nº de dias desde 1899-12-30 (época "serial date").
function excelSerialToISODate(serial) {
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const data = new Date(ms)
  return `${data.getUTCFullYear()}-${pad2(data.getUTCMonth() + 1)}-${pad2(data.getUTCDate())}`
}

function parseData(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return {
      data_relatorio: `${valor.getUTCFullYear()}-${pad2(valor.getUTCMonth() + 1)}-${pad2(valor.getUTCDate())}`,
      erro: null,
    }
  }

  if (typeof valor === 'number' && !Number.isNaN(valor)) {
    return { data_relatorio: excelSerialToISODate(valor), erro: null }
  }

  const texto = String(valor ?? '').trim()

  let match = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) {
    const [, ano, mes, dia] = match
    return montarData(ano, mes, dia, valor)
  }

  match = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (match) {
    const [, dia, mes, ano] = match
    return montarData(ano, mes, dia, valor)
  }

  return {
    data_relatorio: null,
    erro: `Data em formato não reconhecido: "${valor}".`,
  }
}

// Monta a data e valida que dia/mês/ano formam uma data real (rejeita, por
// exemplo, mês 13 ou 31 de fevereiro) antes de aceitar.
function montarData(ano, mes, dia, valorOriginal) {
  const anoNum = Number(ano)
  const mesNum = Number(mes)
  const diaNum = Number(dia)

  const data = new Date(Date.UTC(anoNum, mesNum - 1, diaNum))
  const valida =
    data.getUTCFullYear() === anoNum &&
    data.getUTCMonth() === mesNum - 1 &&
    data.getUTCDate() === diaNum

  if (!valida) {
    return {
      data_relatorio: null,
      erro: `Data inválida: "${valorOriginal}".`,
    }
  }

  return { data_relatorio: `${pad2(anoNum)}-${pad2(mesNum)}-${pad2(diaNum)}`, erro: null }
}

function parseNumero(valor) {
  const texto = String(valor ?? '').trim()
  const match = texto.match(/-?\d+/)

  if (!match) {
    return { numero_rdo: null, erro: `Número do RDO não encontrado em "${valor}".` }
  }

  return { numero_rdo: parseInt(match[0], 10), erro: null }
}

/**
 * Lê um arquivo .csv ou .xlsx de RDOs e retorna as linhas já tratadas
 * conforme as regras de negócio, cada uma com sua lista de erros de
 * validação (vazia quando a linha está OK).
 */
export async function parseRdoFile(file) {
  if (!file) {
    throw new Error('Nenhum arquivo selecionado.')
  }

  if (file.size === 0) {
    throw new Error('O arquivo está vazio.')
  }

  if (file.size > TAMANHO_MAXIMO_BYTES) {
    const tamanhoMb = (file.size / (1024 * 1024)).toFixed(1)
    throw new Error(
      `O arquivo é muito grande (${tamanhoMb} MB). O tamanho máximo permitido é 15 MB — divida a importação em partes menores.`,
    )
  }

  const linhasBrutas = await readRawRows(file)

  if (!linhasBrutas.length) {
    throw new Error('O arquivo não contém linhas de dados.')
  }

  const rawRows = linhasBrutas.map(unwrapRow)

  const { columnMap, faltando } = buildColumnMap(rawRows[0])

  if (faltando.length) {
    const colunasDetectadas = Object.keys(rawRows[0]).length
    const dicaDelimitador =
      colunasDetectadas <= 1
        ? ' O arquivo parece ter apenas uma coluna — confira se o delimitador usado é vírgula ( , ) ou ponto e vírgula ( ; ).'
        : ''
    throw new Error(
      `Colunas esperadas não encontradas no arquivo: ${faltando.join(', ')}.${dicaDelimitador}`,
    )
  }

  return rawRows.map((raw, index) => {
    const obra = parseObra(raw[columnMap.obra])
    const aprovacoes = parseAprovacoes(raw[columnMap.aprovacoes])
    const responsavel = parseResponsavel(raw[columnMap.responsavel])
    const data = parseData(raw[columnMap.data])
    const numero = parseNumero(raw[columnMap.numero])

    const erros = [obra.erro, aprovacoes.erro, responsavel.erro, data.erro, numero.erro].filter(
      Boolean,
    )

    return {
      linha: index + 2, // linha 1 = cabeçalho
      empresa: obra.empresa,
      escopo: obra.escopo,
      numero_contrato: obra.numero_contrato,
      status_aprovacao: aprovacoes.status_aprovacao,
      responsavel_nome: responsavel.responsavel_nome,
      responsavel_email: responsavel.responsavel_email,
      data_relatorio: data.data_relatorio,
      numero_rdo: numero.numero_rdo,
      erros,
    }
  })
}
