import { supabase } from './supabaseClient'

// Ferramenta "Avanço Integrado": tabela avanco_arquivos + bucket de
// Storage `avanco-arquivos` (ver migrations 0016/0017), independentes das
// tabelas de RDO/Validações. Igual ao resto do projeto, o front-end faz o
// fetch/mutação; a autorização de verdade é reforçada em RLS
// (public.is_approved(), ferramenta aberta a todo aprovado).

export const BUCKET_AVANCO = 'avanco-arquivos'
export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024 // 20 MB — upload genérico (QUALISOLDA)
export const TAMANHO_MAXIMO_BYTES_FORTYS = 150 * 1024 * 1024 // 150 MB — cronograma .xml da FORTYS (arquivos reais passam de 90 MB); só limita a leitura em memória no Worker, o arquivo nunca é enviado ao Storage (ver enviarArquivoFortysXml)

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

/**
 * Busca os indicadores extraídos (ver migration 0019 e fortysXmlParse.js)
 * de uma lista de `avanco_arquivos.id` — usado pra montar
 * `indicadoresPorArquivo` (Map arquivo_id -> indicador[]) no
 * DestilariaFase1.jsx, sempre que a lista de arquivos muda.
 */
export async function fetchAvancoIndicadores(arquivoIds) {
  if (!arquivoIds || arquivoIds.length === 0) return []

  const { data, error } = await supabase.from('avanco_indicadores').select('*').in('arquivo_id', arquivoIds)
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

/**
 * Envia o cronograma .xml da FORTYS: NÃO sobe o arquivo pro Storage — ele
 * nunca sai do navegador, só é lido em memória pelo Worker (ver
 * fortysXmlParse.js) pra extrair os percentuais. Grava/atualiza DOIS
 * registros em avanco_arquivos a partir do resultado da extração — um com
 * fase 'destilaria_fase_1' e outro com 'destilaria_fase_2' (ver migration
 * 0016 pra fase/disciplina/empresa sem check constraint) — ambos com
 * `storage_path: null` (ver migration 0022, que tornou essa coluna
 * nullable); `nome_arquivo`/`tamanho_bytes` continuam gravados, só como
 * referência de qual arquivo original gerou aqueles números, nunca o
 * conteúdo em si. `resultadoExtracao` é o retorno de parseFortysXml (ver
 * fortysXmlParse.js): `{ fase1, fase2 }`, cada um com
 * percentualPrevistoGeral/percentualExecutadoGeral + indicadores[].
 *
 * Ao contrário de enviarArquivoAvanco (genérico), aqui a checagem de
 * "já existe arquivo pra essa combinação" é feita NO BANCO, não a partir
 * do estado em memória do front — a página só carrega arquivos da Fase I
 * (fase='destilaria_fase_1'), então não teria como saber se já existe
 * registro da Fase II pra essa mesma Empresa+Escopo+Data.
 */
export async function enviarArquivoFortysXml({ escopo, dataReferencia, arquivo, resultadoExtracao, user, profile }) {
  const disciplina = 'Metal'
  const empresa = 'FORTYS'

  const { data: existentes, error: erroExistentes } = await supabase
    .from('avanco_arquivos')
    .select('*')
    .in('fase', ['destilaria_fase_1', 'destilaria_fase_2'])
    .eq('disciplina', disciplina)
    .eq('empresa', empresa)
    .eq('escopo', escopo)
    .eq('data_referencia', dataReferencia)

  if (erroExistentes) throw erroExistentes
  const existentePorFase = {
    fase1: existentes.find((registro) => registro.fase === 'destilaria_fase_1') ?? null,
    fase2: existentes.find((registro) => registro.fase === 'destilaria_fase_2') ?? null,
  }

  const dadosComuns = {
    nome_arquivo: arquivo.name,
    tamanho_bytes: arquivo.size,
    storage_path: null,
    enviado_por: user?.id ?? null,
    enviado_por_nome: profile?.nome || null,
    enviado_por_email: user?.email || null,
  }

  const registrosSalvos = {}
  const idsInseridosParaDesfazer = []

  try {
    for (const [chave, faseId] of [
      ['fase1', 'destilaria_fase_1'],
      ['fase2', 'destilaria_fase_2'],
    ]) {
      const extraido = resultadoExtracao[chave]
      const existente = existentePorFase[chave]
      const payload = {
        ...dadosComuns,
        percentual_previsto_geral: extraido?.percentualPrevistoGeral ?? null,
        percentual_executado_geral: extraido?.percentualExecutadoGeral ?? null,
      }

      let registro
      if (existente) {
        const { data, error } = await supabase.from('avanco_arquivos').update(payload).eq('id', existente.id).select().single()
        if (error) throw error
        registro = data

        // Registro de antes desta mudança pode ter um storage_path de um
        // upload que esse fluxo não faz mais — limpa o objeto órfão, se
        // houver (best effort: falha aqui não derruba o envio).
        if (existente.storage_path) {
          await supabase.storage.from(BUCKET_AVANCO).remove([existente.storage_path])
        }

        // Reenvio: apaga os indicadores antigos desse arquivo antes de
        // inserir os novos (ver requisito no prompt original).
        const { error: erroLimpar } = await supabase.from('avanco_indicadores').delete().eq('arquivo_id', registro.id)
        if (erroLimpar) throw erroLimpar
      } else {
        const { data, error } = await supabase
          .from('avanco_arquivos')
          .insert({ fase: faseId, disciplina, empresa, escopo, data_referencia: dataReferencia, ...payload })
          .select()
          .single()
        if (error) throw error
        registro = data
        idsInseridosParaDesfazer.push(registro.id)
      }

      const indicadores = (extraido?.indicadores ?? []).map((item) => ({
        arquivo_id: registro.id,
        nome_indicador: item.nome,
        percentual_previsto: item.percentualPrevisto,
        percentual_executado: item.percentualExecutado,
      }))
      if (indicadores.length > 0) {
        const { error: erroIndicadores } = await supabase.from('avanco_indicadores').insert(indicadores)
        if (erroIndicadores) throw erroIndicadores
      }

      registrosSalvos[chave] = registro
    }
  } catch (err) {
    // Desfaz o que deu pra desfazer antes de propagar o erro: registros
    // recém-inseridos (updates a registros pré-existentes ficam como
    // estavam, só sem indicadores novos — não há upload físico a desfazer
    // nesse fluxo).
    if (idsInseridosParaDesfazer.length > 0) {
      await supabase.from('avanco_arquivos').delete().in('id', idsInseridosParaDesfazer)
    }
    throw err
  }

  return registrosSalvos
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
