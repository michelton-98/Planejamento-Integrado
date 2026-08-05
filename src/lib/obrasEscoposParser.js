import { buildColumnMap, parseObra, readRawRows, unwrapRow, validarArquivo } from './fileParsingUtils'

// Campos esperados na planilha de "Escopos - Rondonópolis": só "Obra" e
// "Status" (sem número de RDO, aprovação, etc. — é um cadastro de obras,
// não de relatórios).
const FIELD_ALIASES = {
  obra: ['obra'],
  status: ['status'],
}

// As 4 opções oficiais de status, na grafia exibida na UI.
export const STATUS_OFICIAIS = [
  'Obra Concluída',
  'Obra não iniciada',
  'Obra em Andamento',
  'Obra Paralisada',
]

export const STATUS_PADRAO = 'Obra em Andamento'

// Normaliza um texto de status para comparação: remove acento, caixa,
// prefixo "obra " (opcional na planilha) e colapsa espaços. Assim
// "Não iniciada", "obra não iniciada" e "NÃO INICIADA" caem na mesma
// chave.
function normalizeStatusKey(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/^obra\s+/, '')
    .replace(/\s+/g, ' ')
}

const STATUS_POR_CHAVE = new Map(STATUS_OFICIAIS.map((status) => [normalizeStatusKey(status), status]))

/**
 * Normaliza um valor de status vindo da planilha para uma das 4 opções
 * oficiais. Quando não reconhece o valor, cai no padrão ("Obra em
 * Andamento") e sinaliza `reconhecido: false` para a linha ser destacada
 * na pré-visualização.
 */
export function parseStatusObra(valor) {
  const texto = String(valor ?? '').trim()
  const chave = normalizeStatusKey(texto)
  const oficial = STATUS_POR_CHAVE.get(chave)

  if (oficial) {
    return { status: oficial, statusOriginal: texto, reconhecido: true }
  }

  return { status: STATUS_PADRAO, statusOriginal: texto, reconhecido: false }
}

/**
 * Lê a planilha de Escopos - Rondonópolis (.xlsx, colunas "Obra" e
 * "Status") e retorna as linhas tratadas: empresa/escopo/numero_contrato
 * (reaproveitando a mesma regra de parsing da coluna "Obra" usada nos
 * RDOs) + status normalizado para uma das 4 opções oficiais.
 */
export async function parseObrasEscoposFile(file) {
  validarArquivo(file)

  const linhasBrutas = await readRawRows(file)

  if (!linhasBrutas.length) {
    throw new Error('O arquivo não contém linhas de dados.')
  }

  const rawRows = linhasBrutas.map(unwrapRow)

  const { columnMap, faltando } = buildColumnMap(rawRows[0], FIELD_ALIASES)

  if (faltando.length) {
    const colunasDetectadas = Object.keys(rawRows[0]).length
    const dicaDelimitador =
      colunasDetectadas <= 1
        ? ' O arquivo parece ter apenas uma coluna — confira se as colunas "Obra" e "Status" existem na planilha.'
        : ''
    throw new Error(
      `Colunas esperadas não encontradas no arquivo: ${faltando.join(', ')}.${dicaDelimitador}`,
    )
  }

  return rawRows.map((raw, index) => {
    const obra = parseObra(raw[columnMap.obra])
    const statusInfo = parseStatusObra(raw[columnMap.status])

    return {
      linha: index + 2, // linha 1 = cabeçalho
      empresa: obra.empresa,
      escopo: obra.escopo,
      numero_contrato: obra.numero_contrato,
      status: statusInfo.status,
      statusOriginal: statusInfo.statusOriginal,
      statusReconhecido: statusInfo.reconhecido,
      erro: obra.erro,
    }
  })
}
