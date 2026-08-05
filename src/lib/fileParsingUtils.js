import Papa from 'papaparse'
import * as XLSX from 'xlsx'

// Helpers de leitura/normalização de arquivo (.csv/.xlsx) compartilhados
// pelos parsers de importação (RDOs e Escopos - Rondonópolis). Mantém a
// mesma lógica de detecção de encoding/delimitador e de desembrulho de
// células "forçadas como texto" pelo Excel em todos os importadores.

export const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024 // 15 MB

export const MENSAGEM_CSV_ILEGIVEL =
  'Não foi possível interpretar o arquivo CSV. Verifique se ele não está corrompido e se as ' +
  'colunas estão separadas por vírgula ( , ) ou ponto e vírgula ( ; ).'

// Remove acentos, ordinais ("°"/"º") e normaliza espaços/caixa para
// comparar nomes de coluna sem depender de grafia exata.
export function normalizeKey(key) {
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
export function unwrapExcelForcedText(valor) {
  if (typeof valor !== 'string') return valor
  const match = valor.match(/^="([\s\S]*)"$/)
  if (!match) return valor
  return match[1].replace(/""/g, '"')
}

// Aplica o "desembrulho" acima em todas as chaves e valores de uma linha.
export function unwrapRow(row) {
  const limpo = {}
  for (const [chave, valor] of Object.entries(row)) {
    limpo[unwrapExcelForcedText(chave)] = unwrapExcelForcedText(valor)
  }
  return limpo
}

/**
 * Monta o mapa "campo lógico -> nome de coluna original" a partir de um
 * dicionário `{ campo: [aliases normalizados] }`. Retorna também a lista
 * de campos obrigatórios que não foram encontrados.
 */
export function buildColumnMap(sampleRow, fieldAliases) {
  const normalizedToOriginal = new Map()
  Object.keys(sampleRow).forEach((originalKey) => {
    normalizedToOriginal.set(normalizeKey(originalKey), originalKey)
  })

  const columnMap = {}
  const faltando = []

  for (const [field, aliases] of Object.entries(fieldAliases)) {
    const alias = aliases.find((candidate) => normalizedToOriginal.has(candidate))
    if (alias) {
      columnMap[field] = normalizedToOriginal.get(alias)
    } else {
      faltando.push(aliases[0])
    }
  }

  return { columnMap, faltando }
}

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

/** Valida tamanho/existência do arquivo antes de tentar ler seu conteúdo. */
export function validarArquivo(file) {
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
}

/** Lê um .csv ou .xlsx e retorna as linhas cruas como objetos (chave = cabeçalho). */
export async function readRawRows(file) {
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

/** Separa a coluna "Obra" em { empresa, escopo, numero_contrato }, com erro se o formato não bater. */
export function parseObra(valor) {
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
