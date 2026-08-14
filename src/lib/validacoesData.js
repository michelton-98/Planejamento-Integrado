import { supabase } from './supabaseClient'

// Tabelas próprias da ferramenta "Controle de Validações"
// (validacoes_escopos / validacoes_semanais) — completamente
// independentes de obras_escopos/rdo_relatorios (Controle de RDO), sem
// nenhuma relação entre elas. Ver migration 0010.

export const STATUS_ESCOPO = ['Ativa', 'Concluída', 'Paralisada']
export const STATUS_ESCOPO_PADRAO = 'Ativa'

// Opções fixas do campo "Disciplina" do cadastro de escopo (ver migration
// 0013). Obrigatório só em cadastros novos (validado no front-end, ver
// ValidacoesDataBase.jsx) — escopos cadastrados antes da migration podem
// ter `disciplina: null`, exibido como "Não informado" (rotuloDisciplina).
export const DISCIPLINAS_ESCOPO = ['Civil', 'Metal', 'Elétrica', 'Instrumentação', 'Rotativos']

export function rotuloDisciplina(disciplina) {
  return disciplina || 'Não informado'
}

// As 6 opções fixas do campo "Consideração" — o valor é o texto gravado
// no banco (enum via check constraint, ver migration 0011); a descrição é
// só contexto exibido na interface, não é persistida.
export const CONSIDERACOES = [
  {
    valor: 'Validação em Andamento',
    descricao: 'Em análise pelo Planejamento e pelo Especialista',
  },
  {
    valor: 'Não Validado Pelo Planejamento',
    descricao: 'Necessária alterações no CR/MC ou pendência na entrega de documentos',
  },
  {
    valor: 'Não Validado Pelo Especialista',
    descricao: 'Solicitada correção dos avanços no CR/MC',
  },
  {
    valor: 'Validação Finalizada',
    descricao: 'Documentos constam no sharepoint',
  },
  {
    valor: 'Escopo em Validação Inicial',
    descricao: 'Em fase de elaboração de CR/MC',
  },
  {
    valor: 'Documentos não recebidos',
    descricao: 'Contratada não enviou os documentos de avanço no prazo',
  },
]

export function descricaoConsideracao(valor) {
  return CONSIDERACOES.find((item) => item.valor === valor)?.descricao ?? ''
}

/** Busca todos os escopos cadastrados em validacoes_escopos. */
export async function fetchValidacoesEscopos() {
  const { data, error } = await supabase
    .from('validacoes_escopos')
    .select('*')
    .order('empresa', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function inserirValidacaoEscopo(payload) {
  const { data, error } = await supabase.from('validacoes_escopos').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function atualizarValidacaoEscopo(id, patch) {
  const { data, error } = await supabase
    .from('validacoes_escopos')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removerValidacaoEscopo(id) {
  const { error } = await supabase.from('validacoes_escopos').delete().eq('id', id)
  if (error) throw error
}

/**
 * Busca TODAS as validações semanais de TODOS os escopos numa única
 * consulta (mais barato que uma consulta por escopo), já ordenadas da
 * mais recente pra mais antiga. Quem usa agrupa por escopo_id.
 */
export async function fetchTodasValidacoesSemanais() {
  const { data, error } = await supabase
    .from('validacoes_semanais')
    .select('*')
    .order('criado_em', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Agrupa a lista plana de validações semanais por escopo_id.
 * Retorna um Map<escopo_id, registro[]> já ordenado (mais recente primeiro,
 * pressupondo que `semanais` já veio ordenado de fetchTodasValidacoesSemanais).
 */
export function agruparSemanaisPorEscopo(semanais) {
  const mapa = new Map()
  for (const registro of semanais) {
    const lista = mapa.get(registro.escopo_id) ?? []
    lista.push(registro)
    mapa.set(registro.escopo_id, lista)
  }
  return mapa
}

export async function inserirValidacaoSemanal(payload) {
  const { data, error } = await supabase.from('validacoes_semanais').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function removerValidacaoSemanal(id) {
  const { error } = await supabase.from('validacoes_semanais').delete().eq('id', id)
  if (error) throw error
}

/**
 * Atualiza um registro de validação semanal já existente — qualquer
 * semana, não só a mais recente (decisão tomada na migration 0012: o
 * histórico deixou de ser 100% imutável, o usuário vai atualizando o
 * mesmo registro conforme a validação avança).
 */
export async function atualizarValidacaoSemanal(id, patch) {
  const { data, error } = await supabase
    .from('validacoes_semanais')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Status "de leitura rápida" de um registro, derivado dos 3 checkboxes —
 * usado na lista expandida de "Escopos por consideração" do Dashboard.
 * Prioridade da etapa mais avançada pra menos avançada; Sharepoint
 * marcado sozinho (sem Planejamento nem Especialista) cai no último caso.
 */
export function statusValidacaoRegistro(registro) {
  if (registro.validado_planejamento && registro.validado_especialista && registro.sharepoint) {
    return 'Validação Concluída'
  }
  if (registro.validado_especialista) return 'Validado pelo Especialista'
  if (registro.validado_planejamento) return 'Validado pelo Planejamento'
  return 'Nenhuma etapa validada'
}

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Quantos escopos ATIVOS têm, como validação mais recente, uma
 * "Validação Finalizada" registrada dentro da semana mais recente de
 * atividade (os 7 dias terminando no criado_em mais novo do sistema —
 * não necessariamente "hoje", pra não zerar em telas abertas num período
 * sem nenhum lançamento novo). Usado só como resumo rápido no card do
 * Painel de Ferramentas.
 */
export function contarFinalizadasSemanaMaisRecente(escopos, semanaisPorEscopo) {
  let maisRecente = null
  for (const lista of semanaisPorEscopo.values()) {
    const data = lista[0] ? new Date(lista[0].criado_em) : null
    if (data && (!maisRecente || data > maisRecente)) maisRecente = data
  }
  if (!maisRecente) return 0

  const inicioSemana = new Date(maisRecente.getTime() - SETE_DIAS_MS)

  let total = 0
  for (const escopo of escopos) {
    if (escopo.status !== 'Ativa') continue
    const registro = semanaisPorEscopo.get(escopo.id)?.[0]
    if (!registro) continue
    if (registro.consideracao === 'Validação Finalizada' && new Date(registro.criado_em) >= inicioSemana) {
      total += 1
    }
  }
  return total
}

// --- Datas (modo Semanal/Mensal do Dashboard) ---------------------------
//
// Sempre formatadas manualmente a partir dos componentes locais (nunca
// `.toISOString()`, que converte pra UTC e pode voltar/adiantar um dia
// perto da meia-noite) — assim o texto 'YYYY-MM-DD' bate exatamente com o
// que o Postgres devolve pra uma coluna `date` (sem hora, sem fuso), e dá
// pra comparar os dois com `===`.

function paraISO(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

const QUARTA_FEIRA = 3 // Date#getDay(): 0 = domingo ... 6 = sábado

/**
 * Quarta-feira mais recente (hoje ou anterior), em 'YYYY-MM-DD'. Valor
 * PADRÃO sugerido pro seletor "Data de referência" do Dashboard — quarta
 * é o dia de envio semanal das empresas. Pra mudar esse padrão (ex.: outro
 * dia da semana), troque só a constante QUARTA_FEIRA acima.
 */
export function quartaFeiraMaisRecente(referencia = new Date()) {
  const data = new Date(referencia)
  while (data.getDay() !== QUARTA_FEIRA) {
    data.setDate(data.getDate() - 1)
  }
  return paraISO(data)
}

/** Mês corrente em 'YYYY-MM' — valor padrão do seletor de mês no modo Mensal. */
export function mesAtualISO(referencia = new Date()) {
  return `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, '0')}`
}

/** Todas as quartas-feiras ('YYYY-MM-DD') dentro do mês `mesISO` ('YYYY-MM'). */
export function quartasFeirasDoMes(mesISO) {
  const [ano, mes] = mesISO.split('-').map(Number)
  const datas = []
  const cursor = new Date(ano, mes - 1, 1)
  while (cursor.getMonth() === mes - 1) {
    if (cursor.getDay() === QUARTA_FEIRA) datas.push(paraISO(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return datas
}

/**
 * `true` se `dataISO` ('YYYY-MM-DD') cai numa quarta-feira. Construído a
 * partir dos componentes locais (nunca `new Date(dataISO)` puro, que
 * interpreta a string como UTC e pode devolver o dia da semana errado perto
 * da meia-noite em fusos negativos). Usado pra validar os campos "Início do
 * período"/"Fim do período" do painel de emissão de relatório.
 */
export function ehQuartaFeira(dataISO) {
  if (!dataISO) return false
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  return new Date(ano, mes - 1, dia).getDay() === QUARTA_FEIRA
}

/**
 * Fim máximo permitido pra um período mensal que começa em `inicioISO`
 * (quarta-feira): 28 dias depois, ou seja, no máximo 5 quartas-feiras no
 * período (a inicial conta como a 1ª). Usado como `max` do campo "Fim do
 * período" e pra validar antes de emitir o relatório.
 */
export function fimMaximoPeriodoMensal(inicioISO) {
  const [ano, mes, dia] = inicioISO.split('-').map(Number)
  const data = new Date(ano, mes - 1, dia)
  data.setDate(data.getDate() + 28)
  return paraISO(data)
}

/** Todas as quartas-feiras ('YYYY-MM-DD') entre `inicioISO` e `fimISO`, inclusive. */
export function quartasNoIntervalo(inicioISO, fimISO) {
  const [anoI, mesI, diaI] = inicioISO.split('-').map(Number)
  const [anoF, mesF, diaF] = fimISO.split('-').map(Number)
  const cursor = new Date(anoI, mesI - 1, diaI)
  const fim = new Date(anoF, mesF - 1, diaF)
  const datas = []
  while (cursor <= fim) {
    if (cursor.getDay() === QUARTA_FEIRA) datas.push(paraISO(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return datas
}

/**
 * Indicadores agregados pra aba Dashboard — modo Semanal: considera SÓ os
 * registros cuja data_recebimento seja EXATAMENTE `dataReferencia`
 * ('YYYY-MM-DD') — nunca "o mais recente até essa data" — e só escopos
 * com status "Ativa" (mesma lógica do Controle de RDO, que só conta obras
 * em andamento). Escopo sem nenhum registro nessa data exata entra em
 * `semRegistro` (não conta como validado nem como erro).
 * `semanaisPorEscopo` é o Map de agruparSemanaisPorEscopo (cada lista já
 * ordenada da mais recente pra mais antiga por criado_em).
 */
export function computeValidacoesStatsSemana(escopos, semanaisPorEscopo, dataReferencia) {
  const escoposAtivos = escopos.filter((escopo) => escopo.status === 'Ativa')

  const porConsideracao = new Map(CONSIDERACOES.map((item) => [item.valor, 0]))
  let semRegistro = 0
  let completos = 0
  let incompletos = 0

  for (const escopo of escoposAtivos) {
    const registros = semanaisPorEscopo.get(escopo.id) ?? []
    // Se houver mais de um registro pra mesma data_recebimento (reenvio
    // no mesmo dia), fica o criado por último — a lista já vem ordenada
    // por criado_em desc.
    const registro = registros.find((item) => item.data_recebimento === dataReferencia)

    if (!registro) {
      semRegistro += 1
      continue
    }

    porConsideracao.set(registro.consideracao, (porConsideracao.get(registro.consideracao) ?? 0) + 1)

    const completo = registro.validado_planejamento && registro.validado_especialista && registro.sharepoint
    if (completo) {
      completos += 1
    } else {
      incompletos += 1
    }
  }

  return {
    totalEscoposAtivos: escoposAtivos.length,
    completos,
    incompletos,
    semRegistro,
    porConsideracao: Array.from(porConsideracao.entries()).map(([valor, total]) => ({ valor, total })),
  }
}

/**
 * Escopos ATIVOS cujo registro na data_recebimento EXATA `dataReferencia`
 * tem `consideracao === valorConsideracao` — usado pra expandir uma linha
 * clicada em "Escopos por consideração" (modo Semanal do Dashboard) numa
 * lista de detalhe. Mesma regra de "data exata" de computeValidacoesStatsSemana.
 */
export function listarEscoposPorConsideracaoSemana(escopos, semanaisPorEscopo, dataReferencia, valorConsideracao) {
  const escoposAtivos = escopos.filter((escopo) => escopo.status === 'Ativa')
  const resultado = []

  for (const escopo of escoposAtivos) {
    const registros = semanaisPorEscopo.get(escopo.id) ?? []
    const registro = registros.find((item) => item.data_recebimento === dataReferencia)
    if (registro && registro.consideracao === valorConsideracao) {
      resultado.push({ escopo, registro })
    }
  }

  return resultado
}

/**
 * Detalhe de TODOS os escopos ATIVOS na data de referência exata (mesma
 * regra de "data exata" de computeValidacoesStatsSemana) — um item por
 * escopo, com `registro: null` pros que não têm nenhum lançamento nessa
 * data. Ordenado A-Z por empresa (mesma ordenação da aba Data_Base). Usado
 * pela tabela detalhada do relatório PDF semanal.
 */
export function listarDetalheValidacaoSemana(escopos, semanaisPorEscopo, dataReferencia) {
  const escoposAtivos = escopos.filter((escopo) => escopo.status === 'Ativa')

  return escoposAtivos
    .map((escopo) => {
      const registros = semanaisPorEscopo.get(escopo.id) ?? []
      const registro = registros.find((item) => item.data_recebimento === dataReferencia) ?? null
      return { escopo, registro }
    })
    .sort((a, b) => a.escopo.empresa.localeCompare(b.escopo.empresa, 'pt-BR', { sensitivity: 'base' }))
}

/**
 * Matriz genérica: uma linha por escopo ATIVO, uma coluna por cada data de
 * `quartas` ('YYYY-MM-DD'). Cada célula é "validado" (Cronograma Validado)
 * só se existir um registro pra aquele escopo com data_recebimento
 * EXATAMENTE naquela data E com os 3 checkboxes marcados; qualquer outro
 * caso (sem registro, ou registro com checkbox faltando) é "Cronograma Não
 * Validado / Reprovado". Base tanto do modo Mensal do Dashboard (mês
 * inteiro, ver computeValidacoesMatrizMensal) quanto do período livre do
 * relatório PDF mensal (até 5 quartas-feiras, ver quartasNoIntervalo).
 */
export function computeValidacoesMatrizPeriodo(escopos, semanaisPorEscopo, quartas) {
  const escoposAtivos = escopos.filter((escopo) => escopo.status === 'Ativa')

  const linhas = escoposAtivos.map((escopo) => {
    const registros = semanaisPorEscopo.get(escopo.id) ?? []
    const celulas = quartas.map((data) => {
      const registro = registros.find((item) => item.data_recebimento === data)
      const validado = Boolean(
        registro && registro.validado_planejamento && registro.validado_especialista && registro.sharepoint,
      )
      return { data, validado, registro: registro ?? null }
    })
    return { escopo, celulas }
  })

  return { quartas, linhas }
}

/** Matriz pra aba Dashboard — modo Mensal: todas as quartas-feiras do mês `mesISO` ('YYYY-MM'). */
export function computeValidacoesMatrizMensal(escopos, semanaisPorEscopo, mesISO) {
  return computeValidacoesMatrizPeriodo(escopos, semanaisPorEscopo, quartasFeirasDoMes(mesISO))
}

/**
 * Indicadores agregados a partir de uma matriz já calculada (ver
 * computeValidacoesMatrizPeriodo) — total de escopos ativos e contagem de
 * células validadas/não validadas somando todas as semanas do período.
 * Usado nos cards resumo do relatório PDF mensal.
 */
export function resumoMatrizPeriodo(linhas) {
  let validadas = 0
  let naoValidadas = 0
  for (const { celulas } of linhas) {
    for (const celula of celulas) {
      if (celula.validado) validadas += 1
      else naoValidadas += 1
    }
  }
  return { totalEscoposAtivos: linhas.length, validadas, naoValidadas }
}
