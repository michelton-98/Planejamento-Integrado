import { INDICADORES_FORTYS } from './avancoIntegradoConfig'

// Extrai os indicadores de avanço (% previsto x % executado) do cronograma
// MS Project (.xml, schema padrão MSPDI) da FORTYS. Roda dentro de um Web
// Worker (ver src/workers/fortysXmlParser.worker.js e
// src/lib/fortysXmlWorkerClient.js, que sobe o worker) — arquivos reais
// passam de 90 MB, então tanto a leitura quanto o parse via DOMParser
// travariam a tela por vários segundos se rodassem na thread principal.
//
// Schema: <Project> tem <ExtendedAttributes> (definição dos campos
// customizados, com <FieldID>/<FieldName>/<Alias>) e <Tasks> com uma lista
// FLAT de <Task> (hierarquia é só por WBS/OutlineLevel, sem aninhamento de
// XML). O FieldID dos campos "% previsto"/"% executado" é resolvido
// dinamicamente pelo <FieldName> ("Número2"/"Número3") — nunca hardcoded,
// pois pode mudar entre arquivos/revisões (só o FieldName é estável).

const FIELDNAME_PREVISTO = 'Número2'
const FIELDNAME_EXECUTADO = 'Número3'
const NOME_FASE_1 = 'DESTILARIA FASE I'
const NOME_FASE_2 = 'DESTILARIA FASE II'

const REGEX_ACENTOS_NFD = new RegExp('[̀-ͯ]', 'g')

// Sem diferenciar maiúsculas/acentos, com trim — mesma regra usada tanto
// pra achar a tarefa-resumo de cada fase quanto pra identificar os 6
// indicadores pelo nome da tarefa.
function normalizar(texto) {
  return (texto ?? '')
    .normalize('NFD')
    .replace(REGEX_ACENTOS_NFD, '')
    .toLowerCase()
    .trim()
}

// Regras de identificação dos 6 indicadores por palavra-chave no nome da
// tarefa (ver prompt original) — avaliadas NESTA ORDEM, a primeira que
// bater decide o indicador. A ordem importa de propósito: o nome real de
// "Colunas" ("Nivel + 0 @ +15 (colunas)") também contém "+15", por isso
// esse startsWith precisa ser checado antes das regras de +5/+10/+15.
const REGRAS_INDICADORES = [
  { nome: 'Colunas', bate: (n) => n.startsWith('nivel + 0') || n.startsWith('nivel +0') },
  { nome: 'Nível +5000', bate: (n) => n.includes('nivel +5') || n.includes('+5 @') },
  { nome: 'Nível +10000', bate: (n) => n.includes('nivel +10') || n.includes('+10 @') },
  { nome: 'Nível +15000', bate: (n) => n.includes('nivel +15') && !n.includes('+5') && !n.includes('+10') },
  { nome: 'Escadas', bate: (n) => n.includes('escada') },
  { nome: 'Plataformas', bate: (n) => n.includes('plataforma') },
]

function identificarIndicador(nomeTarefa) {
  const normalizado = normalizar(nomeTarefa)
  return REGRAS_INDICADORES.find((regra) => regra.bate(normalizado))?.nome ?? null
}

function textoFilho(elemento, tag) {
  const filho = elemento.getElementsByTagName(tag)[0]
  return filho ? filho.textContent.trim() : null
}

function paraNumero(texto) {
  if (texto === null || texto === undefined || texto === '') return null
  const numero = Number(texto)
  return Number.isFinite(numero) ? numero : null
}

/** Lê todas as <Task> do documento como uma lista plana, já com os valores dos ExtendedAttributes "Número2"/"Número3" resolvidos. */
function lerTarefas(doc) {
  // getElementsByTagName numa árvore XML casa pelo nome qualificado do
  // elemento (aqui sem prefixo, só xmlns padrão) — ignora a namespace URI,
  // então funciona igual independente do <Project xmlns="...">.
  const containerAtributos = doc.getElementsByTagName('ExtendedAttributes')[0]
  if (!containerAtributos) {
    throw new Error('Arquivo XML inválido: não contém a seção <ExtendedAttributes> (definição dos campos customizados).')
  }

  let fieldIdPrevisto = null
  let fieldIdExecutado = null
  for (const definicao of containerAtributos.getElementsByTagName('ExtendedAttribute')) {
    const fieldName = textoFilho(definicao, 'FieldName')
    if (fieldName === FIELDNAME_PREVISTO) fieldIdPrevisto = textoFilho(definicao, 'FieldID')
    if (fieldName === FIELDNAME_EXECUTADO) fieldIdExecutado = textoFilho(definicao, 'FieldID')
  }

  if (!fieldIdPrevisto || !fieldIdExecutado) {
    throw new Error(
      `Não foram encontrados os campos customizados "${FIELDNAME_PREVISTO}" (% previsto) e/ou "${FIELDNAME_EXECUTADO}" (% executado) neste arquivo.`,
    )
  }

  const containerTarefas = doc.getElementsByTagName('Tasks')[0]
  if (!containerTarefas) {
    throw new Error('Arquivo XML inválido: não contém a seção <Tasks>.')
  }

  const tarefas = []
  for (const task of containerTarefas.getElementsByTagName('Task')) {
    let previsto = null
    let executado = null
    // getElementsByTagName aqui já fica restrito aos descendentes DESSA
    // <Task> — como Task nunca é aninhada em Task (schema MSPDI), pega só
    // os ExtendedAttribute da própria tarefa.
    for (const atributo of task.getElementsByTagName('ExtendedAttribute')) {
      const fieldId = textoFilho(atributo, 'FieldID')
      if (fieldId === fieldIdPrevisto) previsto = paraNumero(textoFilho(atributo, 'Value'))
      if (fieldId === fieldIdExecutado) executado = paraNumero(textoFilho(atributo, 'Value'))
    }

    tarefas.push({
      nome: textoFilho(task, 'Name') ?? '',
      wbs: textoFilho(task, 'WBS') ?? '',
      outlineLevel: Number(textoFilho(task, 'OutlineLevel') ?? '0'),
      previsto,
      executado,
    })
  }
  return tarefas
}

/** Localiza a tarefa-resumo de uma fase pelo nome (sem diferenciar maiúsculas/acentos, com trim). */
function encontrarResumoFase(tarefas, nomeFase) {
  const alvo = normalizar(nomeFase)
  return tarefas.find((tarefa) => normalizar(tarefa.nome) === alvo) ?? null
}

/**
 * Extrai o % geral (lido direto da tarefa-resumo, sem recalcular — o
 * Project já pondera entre as subtarefas) + os 6 indicadores das tarefas
 * DIRETAMENTE abaixo dela (OutlineLevel + 1, WBS prefixado pelo WBS da
 * tarefa-resumo + ".").
 */
function extrairFase(tarefas, resumo) {
  const prefixoFilhos = `${resumo.wbs}.`
  const outlineFilhos = resumo.outlineLevel + 1
  const filhosDiretos = tarefas.filter(
    (tarefa) => tarefa.outlineLevel === outlineFilhos && tarefa.wbs.startsWith(prefixoFilhos),
  )

  const porNome = new Map()
  for (const filho of filhosDiretos) {
    const nomeIndicador = identificarIndicador(filho.nome)
    // Duas tarefas batendo no mesmo indicador não é esperado — fica a
    // primeira encontrada, não sobrescreve.
    if (nomeIndicador && !porNome.has(nomeIndicador)) {
      porNome.set(nomeIndicador, {
        nome: nomeIndicador,
        percentualPrevisto: filho.previsto,
        percentualExecutado: filho.executado,
      })
    }
  }

  return {
    encontrada: true,
    percentualPrevistoGeral: resumo.previsto,
    percentualExecutadoGeral: resumo.executado,
    indicadores: INDICADORES_FORTYS.filter((nome) => porNome.has(nome)).map((nome) => porNome.get(nome)),
    faltantes: INDICADORES_FORTYS.filter((nome) => !porNome.has(nome)),
  }
}

const FASE_NAO_ENCONTRADA = {
  encontrada: false,
  percentualPrevistoGeral: null,
  percentualExecutadoGeral: null,
  indicadores: [],
  faltantes: [...INDICADORES_FORTYS],
}

/** Núcleo puro (sem I/O): recebe o texto já lido do arquivo e devolve `{ fase1, fase2 }`. */
export function parseFortysXmlTexto(xmlTexto) {
  const doc = new DOMParser().parseFromString(xmlTexto, 'application/xml')
  if (doc.getElementsByTagName('parsererror')[0]) {
    throw new Error('Não foi possível ler este arquivo como XML. Confirme se é um cronograma exportado do MS Project.')
  }

  const tarefas = lerTarefas(doc)

  // Fase I é obrigatória: é a única com tela própria habilitada hoje.
  const resumoFase1 = encontrarResumoFase(tarefas, NOME_FASE_1)
  if (!resumoFase1) {
    throw new Error(`Não foi encontrada a seção "${NOME_FASE_1}" neste arquivo.`)
  }
  const fase1 = extrairFase(tarefas, resumoFase1)
  if (fase1.faltantes.length > 0) {
    throw new Error(`Não foram localizados os seguintes indicadores da Destilaria Fase I: ${fase1.faltantes.join(', ')}.`)
  }

  // Fase II é complementar (ainda sem tela própria): se não achar a seção,
  // só pula a extração — não bloqueia o upload.
  const resumoFase2 = encontrarResumoFase(tarefas, NOME_FASE_2)
  const fase2 = resumoFase2 ? extrairFase(tarefas, resumoFase2) : FASE_NAO_ENCONTRADA

  return { fase1, fase2 }
}

/** Lê o arquivo (File/Blob) como texto e extrai — ponto de entrada usado pelo worker. */
export async function parseFortysXml(arquivo) {
  const texto = await arquivo.text()
  return parseFortysXmlTexto(texto)
}
