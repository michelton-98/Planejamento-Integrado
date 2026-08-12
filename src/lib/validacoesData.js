import { supabase } from './supabaseClient'

// Tabelas próprias da ferramenta "Controle de Validações"
// (validacoes_escopos / validacoes_semanais) — completamente
// independentes de obras_escopos/rdo_relatorios (Controle de RDO), sem
// nenhuma relação entre elas. Ver migration 0010.

export const STATUS_ESCOPO = ['Ativa', 'Concluída', 'Paralisada']
export const STATUS_ESCOPO_PADRAO = 'Ativa'

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
 * Matriz pra aba Dashboard — modo Mensal: uma linha por escopo ATIVO, uma
 * coluna por quarta-feira do mês `mesISO` ('YYYY-MM'). Cada célula é
 * "validado" (Cronograma Validado) só se existir um registro pra aquele
 * escopo com data_recebimento EXATAMENTE naquela quarta-feira E com os 3
 * checkboxes marcados; qualquer outro caso (sem registro, ou registro com
 * checkbox faltando) é "Cronograma Não Validado / Reprovado".
 */
export function computeValidacoesMatrizMensal(escopos, semanaisPorEscopo, mesISO) {
  const escoposAtivos = escopos.filter((escopo) => escopo.status === 'Ativa')
  const quartas = quartasFeirasDoMes(mesISO)

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
