import { supabase } from './supabaseClient'

// Tabelas próprias da ferramenta "Controle de Validações"
// (validacoes_escopos / validacoes_semanais) — completamente
// independentes de obras_escopos/rdo_relatorios (Controle de RDO), sem
// nenhuma relação entre elas. Ver migration 0010.

export const STATUS_ESCOPO = ['Ativa', 'Concluída', 'Paralisada']
export const STATUS_ESCOPO_PADRAO = 'Ativa'

// As 5 opções fixas do campo "Consideração" — o texto antes do "—" é o
// valor gravado no banco (enum via check constraint); a descrição é só
// contexto exibido na interface, não é persistida.
export const CONSIDERACOES = [
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
    valor: 'Falha nos entregáveis semanais',
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

/**
 * Indicadores agregados pra aba Dashboard/Resumo: sempre olha só a
 * validação semanal MAIS RECENTE de cada escopo (nunca o histórico
 * inteiro) e só considera escopos com status "Ativa" — mesma lógica do
 * Controle de RDO, que só conta obras em andamento.
 * `semanaisPorEscopo` é o Map de agruparSemanaisPorEscopo (cada lista já
 * ordenada da mais recente pra mais antiga).
 */
export function computeValidacoesStats(escopos, semanaisPorEscopo) {
  const escoposAtivos = escopos.filter((escopo) => escopo.status === 'Ativa')

  const porConsideracao = new Map(CONSIDERACOES.map((item) => [item.valor, 0]))
  let semRegistro = 0
  let completos = 0
  let incompletos = 0

  for (const escopo of escoposAtivos) {
    const maisRecente = semanaisPorEscopo.get(escopo.id)?.[0]

    if (!maisRecente) {
      semRegistro += 1
      continue
    }

    porConsideracao.set(maisRecente.consideracao, (porConsideracao.get(maisRecente.consideracao) ?? 0) + 1)

    const completo =
      maisRecente.validado_planejamento && maisRecente.validado_especialista && maisRecente.sharepoint
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
