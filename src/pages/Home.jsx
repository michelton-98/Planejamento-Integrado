import { useEffect, useRef, useState } from 'react'
import {
  computeDailySeries,
  computeStats,
  computeTopEmpresas,
  computeTopEspecialistas,
  computeUltimaAtualizacao,
  fetchRdoRelatorios,
  inicioDoDiaLocal,
} from '../lib/dashboardData'
import { gerarRelatorioDiarioPdf } from '../lib/pdfReport'
import StatCard from '../components/dashboard/StatCard'
import DailyPendingChart from '../components/dashboard/DailyPendingChart'
import TopBarChart from '../components/dashboard/TopBarChart'
import DrilldownExplorer from '../components/dashboard/DrilldownExplorer'
import VolumeHeatmap from '../components/dashboard/VolumeHeatmap'
import RankingEscoposAtrasados from '../components/dashboard/RankingEscoposAtrasados'
import Spinner from '../components/Spinner'

function formatarDataHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatarData(data) {
  if (!data) return '—'
  return data.toLocaleDateString('pt-BR')
}

/**
 * Data de referência do dashboard: hoje, recalculada em tempo real (nunca
 * fixada em build/deploy). Reagenda a si mesma para a próxima meia-noite
 * local, então uma aba aberta atravessando a virada do dia atualiza a data
 * — e tudo que depende dela (prazo, série diária, Top 5) — sozinha, sem
 * precisar de recarregar a página nem de um novo deploy.
 */
function useDataReferencia() {
  const [dataReferencia, setDataReferencia] = useState(() => inicioDoDiaLocal(new Date()))

  useEffect(() => {
    let timer

    function agendarProximaVirada() {
      const agora = new Date()
      const proximaMeiaNoite = new Date(
        agora.getFullYear(),
        agora.getMonth(),
        agora.getDate() + 1,
        0,
        0,
        5, // pequena folga para garantir que já viramos o dia
      )
      const atraso = proximaMeiaNoite.getTime() - agora.getTime()

      timer = setTimeout(() => {
        setDataReferencia(inicioDoDiaLocal(new Date()))
        agendarProximaVirada()
      }, atraso)
    }

    agendarProximaVirada()
    return () => clearTimeout(timer)
  }, [])

  return dataReferencia
}

export default function Home() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exportando, setExportando] = useState(false)
  const [erroExportacao, setErroExportacao] = useState(null)
  const dataReferencia = useDataReferencia()
  const exploradorRef = useRef(null)

  // Estado compartilhado entre os gráficos Top 5 e o explorador de
  // pendências abaixo: clicar numa barra muda o toggle (tipo) e seleciona
  // o nome direto, sem precisar clicar de novo lá embaixo.
  const [selecaoExplorador, setSelecaoExplorador] = useState({
    tipo: 'contratada',
    nome: null,
  })

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)

    fetchRdoRelatorios()
      .then((data) => {
        if (ativo) setRows(data)
      })
      .catch((err) => {
        if (ativo) setError(err.message)
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [])

  function selecionarNoGrafico(tipo, nome) {
    setSelecaoExplorador({ tipo, nome })
    exploradorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <Spinner className="h-5 w-5 text-accent" />
          Carregando dashboard...
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="text-alert">{error}</p>
      </main>
    )
  }

  const stats = computeStats(rows, dataReferencia)
  const ultimaAtualizacao = computeUltimaAtualizacao(rows)
  const serieDiaria = computeDailySeries(rows, dataReferencia, 15)
  const topEmpresas = computeTopEmpresas(rows, dataReferencia, 5)
  const topEspecialistas = computeTopEspecialistas(rows, dataReferencia, 5)

  async function handleExportarPdf() {
    setExportando(true)
    setErroExportacao(null)
    try {
      await gerarRelatorioDiarioPdf({ rows, dataReferencia, stats, topEmpresas, topEspecialistas })
    } catch (err) {
      setErroExportacao(err.message)
    } finally {
      setExportando(false)
    }
  }

  return (
    <main className="flex-1 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-500">
            <p>
              Última atualização:{' '}
              <span className="font-medium text-navy">{formatarDataHora(ultimaAtualizacao)}</span>
            </p>
            <p>
              Data de referência:{' '}
              <span className="font-medium text-navy">{formatarData(dataReferencia)}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportarPdf}
            disabled={exportando}
            className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
          >
            {exportando && <Spinner className="h-4 w-4" />}
            {exportando ? 'Gerando PDF...' : 'Exportar relatório do dia'}
          </button>
        </div>

        <p className="mb-6 text-xs text-gray-400">
          Considerado atraso quando a aprovação ultrapassa 2 dias úteis a partir da data do RDO.
        </p>

        {erroExportacao && (
          <p className="mb-4 text-sm text-alert">
            Não foi possível gerar o PDF: {erroExportacao}
          </p>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total a Aprovar" value={stats.total} tone="neutral" />
          <StatCard label="Aprovações Atrasadas" value={stats.atrasadas} tone="alert" />
          <StatCard
            label="Aprovações Pendentes: Contratada"
            value={stats.pendenteContratada}
            tone="accent"
          />
          <StatCard
            label="Aprovações Pendentes: Especialista"
            value={stats.pendenteEspecialista}
            tone="accent"
          />
        </div>

        <div className="mb-6">
          <DailyPendingChart data={serieDiaria} />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TopBarChart
            titulo="Top 5 empresas com mais pendências atrasadas"
            data={topEmpresas}
            nomeSelecionado={
              selecaoExplorador.tipo === 'contratada' ? selecaoExplorador.nome : null
            }
            onBarClick={(nome) => selecionarNoGrafico('contratada', nome)}
          />
          <TopBarChart
            titulo="Top 5 especialistas com mais pendências atrasadas"
            data={topEspecialistas}
            nomeSelecionado={
              selecaoExplorador.tipo === 'especialista' ? selecaoExplorador.nome : null
            }
            onBarClick={(nome) => selecionarNoGrafico('especialista', nome)}
          />
        </div>

        <div className="mb-6">
          <VolumeHeatmap rows={rows} dataReferencia={dataReferencia} />
        </div>

        <div className="mb-6">
          <RankingEscoposAtrasados rows={rows} dataReferencia={dataReferencia} />
        </div>

        <div ref={exploradorRef}>
          <DrilldownExplorer
            rows={rows}
            dataReferencia={dataReferencia}
            tipo={selecaoExplorador.tipo}
            selecionado={selecaoExplorador.nome}
            onTipoChange={(tipo) => setSelecaoExplorador((atual) => ({ ...atual, tipo }))}
            onSelecionadoChange={(nome) =>
              setSelecaoExplorador((atual) => ({ ...atual, nome }))
            }
          />
        </div>
      </div>
    </main>
  )
}
