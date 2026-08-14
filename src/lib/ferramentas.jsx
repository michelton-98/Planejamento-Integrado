import {
  computeStats,
  fetchRdoRelatorios,
  filtrarRdosEmAndamento,
  inicioDoDiaLocal,
} from './dashboardData'
import { fetchObrasEscopos } from './obrasEscoposData'
import { supabase } from './supabaseClient'
import { AVANCO_CONFIG, FASES_AVANCO } from './avancoIntegradoConfig'
import { calcularAvancoPorEmpresa, fetchAvancoArquivos } from './avancoIntegradoData'
import {
  agruparSemanaisPorEscopo,
  contarFinalizadasSemanaMaisRecente,
  fetchTodasValidacoesSemanais,
  fetchValidacoesEscopos,
} from './validacoesData'

// Resumo do card "Controle de RDO": total a aprovar + atrasadas, com uma
// barra de "taxa de atraso" — mesmos números do topo do dashboard em
// /rdo (computeStats), só que recalculados aqui pro card do Painel.
async function estatisticasRdo() {
  const [rows, obras] = await Promise.all([fetchRdoRelatorios(), fetchObrasEscopos()])
  const ativas = filtrarRdosEmAndamento(rows, obras)
  const stats = computeStats(ativas, inicioDoDiaLocal(new Date()))
  const pctAtraso = stats.total ? Math.round((stats.atrasadas / stats.total) * 100) : 0

  return {
    colunas: [
      { valor: stats.total, rotulo: 'A aprovar' },
      { valor: stats.atrasadas, rotulo: 'Atrasadas' },
    ],
    barras: stats.total ? [{ rotulo: 'Taxa de atraso', percentual: pctAtraso, cor: '#d1495b' }] : [],
  }
}

// Resumo do card "Gestão de Usuários": quantos já estão aprovados vs.
// quantos aguardam aprovação — os dois números que mais importam pra
// quem abre essa ferramenta.
async function estatisticasUsuarios() {
  const [aprovadosRes, pendentesRes] = await Promise.all([
    supabase.from('perfis').select('id', { count: 'exact', head: true }).eq('status_aprovacao', 'aprovado'),
    supabase.from('perfis').select('id', { count: 'exact', head: true }).eq('status_aprovacao', 'pendente'),
  ])

  if (aprovadosRes.error) throw aprovadosRes.error
  if (pendentesRes.error) throw pendentesRes.error

  return {
    colunas: [
      { valor: aprovadosRes.count ?? 0, rotulo: 'Aprovados' },
      { valor: pendentesRes.count ?? 0, rotulo: 'Pendentes' },
    ],
  }
}

// Resumo do card "Controle de Validações": total de escopos cadastrados +
// quantos tiveram validação finalizada na semana mais recente (ver
// contarFinalizadasSemanaMaisRecente).
async function estatisticasValidacoes() {
  const [escopos, semanais] = await Promise.all([fetchValidacoesEscopos(), fetchTodasValidacoesSemanais()])
  const semanaisPorEscopo = agruparSemanaisPorEscopo(semanais)

  return {
    colunas: [
      { valor: escopos.length, rotulo: 'Escopos cadastrados' },
      { valor: contarFinalizadasSemanaMaisRecente(escopos, semanaisPorEscopo), rotulo: 'Finalizadas na semana' },
    ],
  }
}

// Resumo do card "Avanço Integrado": total de arquivos já enviados +
// cobertura média de envio (empresas de input genérico, ex. QUALISOLDA) +
// % executado mais recente do cronograma (empresas de input xml_ms_project,
// ex. FORTYS) — só considera a Destilaria Fase I por enquanto, a única
// fase/ferramenta de verdade habilitada (ver FASES_AVANCO em
// avancoIntegradoConfig.js).
async function estatisticasAvancoIntegrado() {
  const fase = FASES_AVANCO[0].chave
  const arquivos = await fetchAvancoArquivos(fase)

  const indicadoresCobertura = Object.entries(AVANCO_CONFIG[fase] ?? {}).flatMap(([disciplina, config]) =>
    Object.entries(config.empresas ?? {})
      .filter(([, configEmpresa]) => configEmpresa.tipoInput !== 'xml_ms_project')
      .flatMap(([empresa, configEmpresa]) =>
        calcularAvancoPorEmpresa(
          arquivos.filter((arquivo) => arquivo.disciplina === disciplina),
          { [empresa]: configEmpresa.escopos },
        ),
      ),
  )
  const comDados = indicadoresCobertura.filter((indicador) => indicador.dataReferencia)
  const coberturaMedia = comDados.length
    ? Math.round(comDados.reduce((soma, indicador) => soma + indicador.percentual, 0) / comDados.length)
    : 0

  // Cronograma FORTYS: % executado geral do arquivo com data_referencia
  // mais recente (mesma ideia de "data mais recente" usada em
  // calcularAvancoPorEmpresa, só que lendo direto de avanco_arquivos —
  // aqui já é um valor percentual pronto, não uma cobertura de envio).
  const maisRecenteFortys = arquivos
    .filter((arquivo) => arquivo.empresa === 'FORTYS')
    .reduce((maisRecente, atual) => (!maisRecente || atual.data_referencia > maisRecente.data_referencia ? atual : maisRecente), null)

  const barras = []
  if (comDados.length) barras.push({ rotulo: 'Cobertura média de envio', percentual: coberturaMedia, cor: '#7c3aed' })
  if (maisRecenteFortys?.percentual_executado_geral != null) {
    barras.push({
      rotulo: 'Execução FORTYS (cronograma)',
      percentual: Math.round(maisRecenteFortys.percentual_executado_geral),
      cor: '#7c3aed',
    })
  }

  return {
    colunas: [{ valor: arquivos.length, rotulo: 'Arquivos enviados' }],
    barras,
  }
}

// Catálogo de ferramentas do Painel (tela inicial "/"). Cada entrada vira
// um card — pra adicionar uma nova ferramenta no futuro basta acrescentar
// um item aqui, sem tocar na tela do painel em si. `somenteAdmin` filtra
// o card pra quem tem perfil.is_admin; `carregarEstatisticas` é opcional
// e busca, de forma independente por ferramenta, o resumo exibido no
// card (colunas de números + barras de progresso) — ver ToolCard.jsx.
export const FERRAMENTAS = [
  {
    chave: 'rdo',
    titulo: 'Controle de RDO',
    categoria: 'Obras · Acompanhamento',
    descricao: 'Indicadores, pendências por disciplina e relatório diário de aprovação de RDOs.',
    href: '/rdo',
    corFaixa: '#2f6fed',
    somenteAdmin: false,
    carregarEstatisticas: estatisticasRdo,
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-6 w-6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 3.75h6a1.5 1.5 0 0 1 1.5 1.5v.75h1.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4.5 19.5v-12a1.5 1.5 0 0 1 1.5-1.5H7.5V5.25A1.5 1.5 0 0 1 9 3.75Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 10.5h7.5M8.25 13.5h7.5M8.25 16.5h4.5" />
      </svg>
    ),
  },
  {
    chave: 'validacoes',
    titulo: 'Controle de Validações',
    categoria: 'Obras · Validação',
    descricao: 'Cadastro de escopos e histórico semanal de validação (Planejamento, Especialista, Sharepoint).',
    href: '/validacoes',
    corFaixa: '#178a54',
    somenteAdmin: false,
    carregarEstatisticas: estatisticasValidacoes,
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-6 w-6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    ),
  },
  {
    chave: 'avanco_integrado',
    titulo: 'Avanço Integrado',
    categoria: 'Obras · Avanço físico',
    descricao: 'Envio de arquivos de avanço por disciplina/empresa e indicadores de cobertura, por fase da planta.',
    href: '/avanco-integrado',
    corFaixa: '#7c3aed',
    somenteAdmin: false,
    carregarEstatisticas: estatisticasAvancoIntegrado,
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-6 w-6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 19.5h16.5M6.75 19.5v-6M11.25 19.5v-9.75M15.75 19.5V6M20.25 19.5V9.75"
        />
      </svg>
    ),
  },
  {
    chave: 'usuarios',
    // 'usuarios' fica de fora do checklist de "Personalizar Acesso" (ver
    // AdminUsuarios.jsx) por causa de somenteAdmin: true — admins sempre
    // têm acesso automático, não passa pelo mecanismo de personalização.
    titulo: 'Gestão de Usuários',
    categoria: 'Administração · Acesso',
    descricao: 'Aprove cadastros, promova administradores e remova acessos do sistema.',
    href: '/admin/usuarios',
    corFaixa: '#a9791f',
    somenteAdmin: true,
    carregarEstatisticas: estatisticasUsuarios,
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-6 w-6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.5a4.5 4.5 0 0 0-9 0M18.75 19.5a4.125 4.125 0 0 0-3.132-4M10.5 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17.25 11.25a3 3 0 0 0 2.906-3.75"
        />
      </svg>
    ),
  },
]

/**
 * `true` se `profile` pode ver/acessar a ferramenta `chave` no Painel —
 * usado tanto pra filtrar os cards em Home.jsx quanto pra bloquear a rota
 * direta em ProtectedRoute.jsx. Admins sempre têm acesso total (não passam
 * pelo campo `ferramentas_permitidas`); pra usuários comuns, null/array
 * vazio (nunca personalizado, ver migration 0014) também é acesso total —
 * só uma lista explícita restringe. Ver AdminUsuarios.jsx ("Personalizar
 * Acesso", exclusivo da conta master) para quem grava esse campo.
 */
export function temAcessoFerramenta(profile, chave) {
  if (!profile) return false
  if (profile.is_admin) return true
  const permitidas = profile.ferramentas_permitidas
  if (!permitidas || permitidas.length === 0) return true
  return permitidas.includes(chave)
}

/**
 * `true` se `profile` pode ver/usar a aba "Importar RDOs" (rota /input,
 * dentro do Controle de RDO) — importação do relatório diário e cadastro
 * de "Escopos - Rondonópolis". Mecanismo independente de
 * ferramentas_permitidas/temAcessoFerramenta (ver migration 0015): ao
 * contrário dele, o padrão AQUI é restrito — só admins têm acesso
 * automático; usuários comuns só entram com `pode_importar_rdos = true`,
 * ligado explicitamente pela conta master em "Personalizar Acesso"
 * (AdminUsuarios.jsx). É só bloqueio de interface/rota — a permissão de
 * escrita real (rdo_relatorios/obras_escopos) é reforçada em paralelo por
 * RLS (public.pode_gerenciar_rdo_input()).
 */
export function podeImportarRdos(profile) {
  return Boolean(profile?.is_admin || profile?.pode_importar_rdos)
}
