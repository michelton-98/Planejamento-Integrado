import { supabase } from './supabaseClient'

// Ferramenta "Avanço Integrado": tabela avanco_arquivos + bucket de
// Storage `avanco-arquivos` (ver migrations 0016/0017), independentes das
// tabelas de RDO/Validações. Igual ao resto do projeto, o front-end faz o
// fetch/mutação; a autorização de verdade é reforçada em RLS
// (public.is_approved(), ferramenta aberta a todo aprovado).

export const BUCKET_AVANCO = 'avanco-arquivos'
export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024 // 20 MB

/** Busca todos os arquivos cadastrados de uma fase (todas as disciplinas/empresas/datas de uma vez). */
export async function fetchAvancoArquivos(fase) {
  const { data, error } = await supabase
    .from('avanco_arquivos')
    .select('*')
    .eq('fase', fase)
    .order('data_referencia', { ascending: false })

  if (error) throw error
  return data ?? []
}

// Caminho no Storage: só ASCII/dígitos/hífen (nomes de empresa/escopo têm
// acento e espaço) + um sufixo aleatório, pra nunca colidir mesmo em
// reenvios rápidos da mesma combinação Empresa+Escopo+Data.
const REGEX_ACENTOS_NFD = new RegExp('[̀-ͯ]', 'g')

function slug(texto) {
  return texto
    .normalize('NFD')
    .replace(REGEX_ACENTOS_NFD, '') // remove os acentos isolados pela forma decomposta do NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function caminhoStorage({ fase, disciplina, empresa, escopo, dataReferencia, nomeArquivo }) {
  const sufixo = crypto.randomUUID()
  return `${fase}/${slug(disciplina)}/${slug(empresa)}/${slug(escopo)}/${dataReferencia}/${sufixo}-${nomeArquivo}`
}

/**
 * Envia um arquivo pra uma combinação Fase+Disciplina+Empresa+Escopo+Data.
 * `registroExistente` (opcional): a linha já cadastrada pra essa combinação
 * exata, se o usuário confirmou a substituição (ver AvancoInput.jsx) — sem
 * ela, insere um registro novo; com ela, sobe o arquivo novo, atualiza a
 * MESMA linha (mantém o id/histórico) e só depois apaga o arquivo antigo do
 * Storage.
 */
export async function enviarArquivoAvanco({
  fase,
  disciplina,
  empresa,
  escopo,
  dataReferencia,
  arquivo,
  registroExistente,
  user,
  profile,
}) {
  const storagePath = caminhoStorage({ fase, disciplina, empresa, escopo, dataReferencia, nomeArquivo: arquivo.name })

  const { error: erroUpload } = await supabase.storage.from(BUCKET_AVANCO).upload(storagePath, arquivo)
  if (erroUpload) throw erroUpload

  const dadosComuns = {
    nome_arquivo: arquivo.name,
    tamanho_bytes: arquivo.size,
    storage_path: storagePath,
    enviado_por: user?.id ?? null,
    enviado_por_nome: profile?.nome || null,
    enviado_por_email: user?.email || null,
  }

  if (registroExistente) {
    const { data, error } = await supabase
      .from('avanco_arquivos')
      .update(dadosComuns)
      .eq('id', registroExistente.id)
      .select()
      .single()

    if (error) {
      // Não conseguiu atualizar o registro: desfaz o upload pra não deixar
      // arquivo órfão no Storage.
      await supabase.storage.from(BUCKET_AVANCO).remove([storagePath])
      throw error
    }

    // Só remove o arquivo antigo depois que a troca do registro já foi
    // confirmada no banco.
    await supabase.storage.from(BUCKET_AVANCO).remove([registroExistente.storage_path])
    return data
  }

  const { data, error } = await supabase
    .from('avanco_arquivos')
    .insert({
      fase,
      disciplina,
      empresa,
      escopo,
      data_referencia: dataReferencia,
      ...dadosComuns,
    })
    .select()
    .single()

  if (error) {
    await supabase.storage.from(BUCKET_AVANCO).remove([storagePath])
    throw error
  }
  return data
}

/** Baixa o arquivo de um registro (bucket privado — passa pela mesma RLS de leitura) e dispara o download no navegador. */
export async function baixarArquivoAvanco(registro) {
  const { data, error } = await supabase.storage.from(BUCKET_AVANCO).download(registro.storage_path)
  if (error) throw error

  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = registro.nome_arquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Grava o filtro de disciplinas do Dashboard no perfil do usuário logado
 * (coluna perfis.avanco_dashboard_disciplinas, ver migration 0018) — via
 * RPC (não update direto) porque a tabela perfis não libera UPDATE pra
 * usuário comum na própria linha (só admin, ver migration 0002); a função
 * é security definer e só mexe na linha do próprio auth.uid().
 * `disciplinas: null` grava "todas marcadas" (o padrão).
 */
export async function salvarDisciplinasDashboard(disciplinas) {
  const { data, error } = await supabase.rpc('set_avanco_dashboard_disciplinas', { disciplinas })
  if (error) throw error
  return data
}

// --- Indicadores do Dashboard --------------------------------------------

/**
 * Indicador "Avanço por Empresa" de UMA disciplina: pra cada empresa
 * cadastrada nela (ver `empresas` de avancoIntegradoConfig.js), calcula a
 * % de escopos que já têm pelo menos 1 arquivo enviado NA DATA DE
 * REFERÊNCIA MAIS RECENTE encontrada no banco pra aquela empresa —
 * cobertura de envio, não avanço real (ver comentário no prompt original;
 * isso é só o primeiro indicador, mais virão depois). Empresa sem nenhum
 * arquivo enviado ainda entra com 0% e `dataReferencia: null`.
 */
export function calcularAvancoPorEmpresa(arquivosDaDisciplina, empresas) {
  return Object.entries(empresas).map(([empresa, escopos]) => {
    const arquivosDaEmpresa = arquivosDaDisciplina.filter((arquivo) => arquivo.empresa === empresa)

    if (arquivosDaEmpresa.length === 0) {
      return { empresa, dataReferencia: null, escoposEnviados: 0, totalEscopos: escopos.length, percentual: 0 }
    }

    const dataReferencia = arquivosDaEmpresa.reduce(
      (maisRecente, arquivo) => (arquivo.data_referencia > maisRecente ? arquivo.data_referencia : maisRecente),
      arquivosDaEmpresa[0].data_referencia,
    )

    const escoposComArquivo = new Set(
      arquivosDaEmpresa.filter((arquivo) => arquivo.data_referencia === dataReferencia).map((arquivo) => arquivo.escopo),
    )

    return {
      empresa,
      dataReferencia,
      escoposEnviados: escoposComArquivo.size,
      totalEscopos: escopos.length,
      percentual: escopos.length ? Math.round((escoposComArquivo.size / escopos.length) * 100) : 0,
    }
  })
}
