import { supabase } from './supabaseClient'
import { construirIndiceObras, encontrarObraCorrespondente } from './obraMatching'

export const DISCIPLINAS = ['Civil', 'Metal', 'Elétrica', 'Instrumentação', 'Rotativos', 'Qualidade']

/** Busca todas as obras cadastradas em obras_escopos. */
export async function fetchObrasEscopos() {
  const { data, error } = await supabase
    .from('obras_escopos')
    .select('*')
    .order('empresa', { ascending: true })

  if (error) throw error
  return data ?? []
}

/**
 * Aplica as linhas válidas de uma importação de planilha na tabela
 * obras_escopos: obra já cadastrada (por empresa+escopo — ver
 * obraMatching.js) tem só o `status` atualizado; obra nova é inserida com
 * `disciplina: null` (preenchida manualmente depois pela tela). Retorna
 * quantas foram criadas e quantas atualizadas.
 */
export async function aplicarImportacaoObras(linhasValidas) {
  const obrasAtuais = await fetchObrasEscopos()
  const indice = construirIndiceObras(obrasAtuais)

  const novas = []
  const atualizacoes = []

  for (const linha of linhasValidas) {
    const existente = encontrarObraCorrespondente(linha, indice)

    if (existente) {
      if (existente.status !== linha.status) {
        atualizacoes.push({ id: existente.id, status: linha.status })
      }
    } else {
      novas.push({
        numero_contrato: linha.numero_contrato,
        empresa: linha.empresa,
        escopo: linha.escopo,
        disciplina: null,
        status: linha.status,
      })
    }
  }

  if (novas.length) {
    const { error } = await supabase.from('obras_escopos').insert(novas)
    if (error) throw error
  }

  for (const { id, status } of atualizacoes) {
    const { error } = await supabase
      .from('obras_escopos')
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }

  return { criadas: novas.length, atualizadas: atualizacoes.length }
}

export async function inserirObraEscopo(payload) {
  const { data, error } = await supabase.from('obras_escopos').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function atualizarObraEscopo(id, patch) {
  const { data, error } = await supabase
    .from('obras_escopos')
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removerObraEscopo(id) {
  const { error } = await supabase.from('obras_escopos').delete().eq('id', id)
  if (error) throw error
}
