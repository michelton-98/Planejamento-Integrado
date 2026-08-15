import { INDICADORES_FORTYS } from './avancoIntegradoConfig'

// Extrai os indicadores de avanço (% previsto x % executado) do cronograma
// MS Project (.xml, schema padrão MSPDI) da FORTYS. Roda dentro de um Web
// Worker (ver src/workers/fortysXmlParser.worker.js e
// src/lib/fortysXmlWorkerClient.js, que sobe o worker) — arquivos reais
// passam de 90 MB, então tanto a leitura quanto o parse travariam a tela
// por vários segundos se rodassem na thread principal.
//
// IMPORTANTE: o parsing aqui é feito por VARREDURA DE TEXTO (indexOf +
// regex), NÃO por DOMParser — de propósito, em duas frentes:
//   1) DOMParser não é garantido dentro de Web Workers em todo navegador
//      (a exposição em Worker é relativamente recente na spec e nem toda
//      versão/engine implementa) — como este módulo roda inteiro dentro
//      do worker, depender de DOMParser falha silenciosamente em qualquer
//      navegador/versão sem esse suporte ("DOMParser is not defined").
//   2) mesmo onde funcionaria, montar uma árvore DOM inteira de um
//      arquivo de ~90MB consome bem mais memória/tempo do que percorrer o
//      texto uma vez com indexOf — a estrutura do arquivo (ver abaixo) é
//      simples o bastante pra não precisar de árvore nenhuma.
//
// Schema: <Project> tem <ExtendedAttributes> (definição dos campos
// customizados, com <FieldID>/<FieldName>/<Alias>) e <Tasks> com uma lista
// FLAT de <Task> (hierarquia é só por WBS/OutlineLevel, sem aninhamento de
// XML — nem Task dentro de Task, nem ExtendedAttributes dentro de Task).
// O FieldID dos campos "% previsto"/"% executado" é resolvido
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

function paraNumero(texto) {
  if (texto === null || texto === undefined || texto === '') return null
  const numero = Number(texto)
  return Number.isFinite(numero) ? numero : null
}

// --- decodificação de entidades XML --------------------------------------
//
// Conteúdo de texto entre tags pode vir com entidades escapadas (nomes de
// tarefa com "&", por exemplo). &amp; precisa ser decodificado por ÚLTIMO,
// senão uma sequência como "&amp;lt;" vira "&lt;" e depois "<" errado.
function decodeEntidades(texto) {
  if (!texto) return texto
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
}

// --- varredura de blocos por indexOf -------------------------------------
//
// Extrai o conteúdo entre a primeira ocorrência de `tagAbertura` (a partir
// de `posInicial`) e o `tagFechamento` correspondente. Como nenhum dos
// elementos que percorremos é aninhado em si mesmo (Task não tem Task
// dentro, ExtendedAttribute não tem ExtendedAttribute dentro — ver schema
// no topo do arquivo), a primeira tag de fechamento encontrada É a
// correspondente: não precisa contar aninhamento.
function extrairBloco(texto, tagAbertura, tagFechamento, posInicial) {
  const inicio = texto.indexOf(tagAbertura, posInicial)
  if (inicio === -1) return null
  const inicioConteudo = inicio + tagAbertura.length
  const fim = texto.indexOf(tagFechamento, inicioConteudo)
  if (fim === -1) return null
  return { conteudo: texto.slice(inicioConteudo, fim), fimBloco: fim + tagFechamento.length }
}

/** Itera TODOS os blocos `tagAbertura...tagFechamento` de um texto, na ordem em que aparecem. */
function* iterarBlocos(texto, tagAbertura, tagFechamento) {
  let pos = 0
  for (;;) {
    const bloco = extrairBloco(texto, tagAbertura, tagFechamento, pos)
    if (!bloco) return
    yield bloco.conteudo
    pos = bloco.fimBloco
  }
}

// Tags-folha (sem filhos, valor puro) extraídas por regex: `[^<]*` casa
// tudo até a próxima tag — mais rápido que `[\s\S]*?` porque não faz
// backtracking, e correto porque conteúdo de texto XML bem formado nunca
// tem um "<" literal (só escapado como "&lt;").
const RE_NAME = /<Name>([^<]*)<\/Name>/
const RE_WBS = /<WBS>([^<]*)<\/WBS>/
const RE_OUTLINE = /<OutlineLevel>([^<]*)<\/OutlineLevel>/
const RE_FIELD_ID = /<FieldID>([^<]*)<\/FieldID>/
const RE_FIELD_NAME = /<FieldName>([^<]*)<\/FieldName>/
const RE_VALUE = /<Value>([^<]*)<\/Value>/

function primeiroGrupo(regex, texto) {
  const match = regex.exec(texto)
  return match ? decodeEntidades(match[1]) : null
}

/** Lê os pares FieldID/FieldName/Value de todo <ExtendedAttribute> encontrado DENTRO de um bloco (uma <Task> ou o container <ExtendedAttributes>). */
function lerAtributosDoBloco(blocoTexto) {
  const atributos = []
  for (const bloco of iterarBlocos(blocoTexto, '<ExtendedAttribute>', '</ExtendedAttribute>')) {
    atributos.push({
      fieldId: primeiroGrupo(RE_FIELD_ID, bloco),
      fieldName: primeiroGrupo(RE_FIELD_NAME, bloco),
      value: primeiroGrupo(RE_VALUE, bloco),
    })
  }
  return atributos
}

/** Lê todas as <Task> do documento como uma lista plana, já com os valores dos ExtendedAttributes "Número2"/"Número3" resolvidos. */
function lerTarefas(xmlTexto) {
  const containerAtributos = extrairBloco(xmlTexto, '<ExtendedAttributes>', '</ExtendedAttributes>', 0)
  if (!containerAtributos) {
    throw new Error('Arquivo XML inválido: não contém a seção <ExtendedAttributes> (definição dos campos customizados).')
  }

  let fieldIdPrevisto = null
  let fieldIdExecutado = null
  for (const atributo of lerAtributosDoBloco(containerAtributos.conteudo)) {
    if (atributo.fieldName === FIELDNAME_PREVISTO) fieldIdPrevisto = atributo.fieldId
    if (atributo.fieldName === FIELDNAME_EXECUTADO) fieldIdExecutado = atributo.fieldId
  }

  if (!fieldIdPrevisto || !fieldIdExecutado) {
    throw new Error(
      `Não foram encontrados os campos customizados "${FIELDNAME_PREVISTO}" (% previsto) e/ou "${FIELDNAME_EXECUTADO}" (% executado) neste arquivo.`,
    )
  }

  // Busca <Tasks> a partir do fim de <ExtendedAttributes> (sempre vem
  // depois, no schema) — só evita reescanear o trecho já lido.
  const containerTarefas = extrairBloco(xmlTexto, '<Tasks>', '</Tasks>', containerAtributos.fimBloco)
  if (!containerTarefas) {
    throw new Error('Arquivo XML inválido: não contém a seção <Tasks>.')
  }

  const tarefas = []
  for (const blocoTask of iterarBlocos(containerTarefas.conteudo, '<Task>', '</Task>')) {
    let previsto = null
    let executado = null
    // lerAtributosDoBloco aqui já fica restrito ao conteúdo DESSA
    // <Task> — como Task nunca é aninhada em Task (schema MSPDI), pega só
    // os ExtendedAttribute da própria tarefa.
    for (const atributo of lerAtributosDoBloco(blocoTask)) {
      if (atributo.fieldId === fieldIdPrevisto) previsto = paraNumero(atributo.value)
      if (atributo.fieldId === fieldIdExecutado) executado = paraNumero(atributo.value)
    }

    tarefas.push({
      nome: primeiroGrupo(RE_NAME, blocoTask) ?? '',
      wbs: primeiroGrupo(RE_WBS, blocoTask) ?? '',
      outlineLevel: Number(primeiroGrupo(RE_OUTLINE, blocoTask) ?? '0'),
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
  if (!xmlTexto.includes('<Project')) {
    throw new Error('Não foi possível ler este arquivo como XML. Confirme se é um cronograma exportado do MS Project.')
  }

  const tarefas = lerTarefas(xmlTexto)

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
