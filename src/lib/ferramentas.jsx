import {
  computeStats,
  fetchRdoRelatorios,
  filtrarRdosEmAndamento,
  inicioDoDiaLocal,
} from './dashboardData'
import { fetchObrasEscopos } from './obrasEscoposData'
import { supabase } from './supabaseClient'
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
    chave: 'usuarios',
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
