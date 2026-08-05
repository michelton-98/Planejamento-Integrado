import { buildColumnMap, parseObra, readRawRows, unwrapRow, validarArquivo } from './fileParsingUtils'

// Campos que o arquivo precisa conter (por alias normalizado) para o parsing
// funcionar.
const FIELD_ALIASES = {
  obra: ['obra'],
  aprovacoes: ['aprovacoes', 'aprovacao'],
  responsavel: ['aguardando aprovacao de', 'aguardando aprovacaode'],
  data: ['data do relatorio', 'data relatorio', 'data'],
  numero: ['n', 'no', 'numero', 'numero rdo', 'numero do rdo'],
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
