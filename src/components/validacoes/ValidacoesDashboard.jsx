import { useMemo, useState } from 'react'
import {
  computeValidacoesMatrizMensal,
  computeValidacoesStatsSemana,
  listarEscoposPorConsideracaoSemana,
  listarEscoposSemRegistroSemana,
  mesAtualISO,
  quartaFeiraMaisRecente,
  statusValidacaoRegistro,
} from '../../lib/validacoesData'
import Card from '../Card'
import StatCard from '../dashboard/StatCard'
import ToggleModo from './ToggleModo'

// Cores por consideração — mesma paleta usada no resto do app (accent =
// informativo, alert = problema, gold = atenção, success = positivo).
const COR_CONSIDERACAO = {
  'Validação em Andamento': '#2f6fed',
  'Não Validado Pelo Planejamento': '#d1495b',
  'Não Validado Pelo Especialista': '#d1495b',
  'Validação Finalizada': '#178a54',
  'Escopo em Validação Inicial': '#a9791f',
  'Documentos não recebidos': '#d1495b',
}

// Só dia/mês no cabeçalho da coluna — o ano já está implícito no seletor
// "Mês de referência" logo acima da tabela.
function formatarDataBR(dataISO) {
  if (!dataISO) return '—'
  const [, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}`
}

// Sentinela pra "linha Sem registro nesta data" do quadro "Escopos por
// consideração" — mesmo texto exibido na linha, usado como valor de
// consideracaoSelecionada pra distinguir de um valor real de CONSIDERACOES
// (nenhum dos 6 valores fixos é igual a esse texto).
const SEM_REGISTRO_SENTINELA = 'Sem registro nesta data'

/** Busca o total já calculado de `stats.porConsideracao` pra um valor específico. */
function totalPorConsideracao(stats, valor) {
  return stats.porConsideracao.find((item) => item.valor === valor)?.total ?? 0
}

function DashboardSemanal({ escopos, semanaisPorEscopo, dataReferencia }) {
  const [consideracaoSelecionada, setConsideracaoSelecionada] = useState(null)

  const stats = useMemo(
    () => computeValidacoesStatsSemana(escopos, semanaisPorEscopo, dataReferencia),
    [escopos, semanaisPorEscopo, dataReferencia],
  )

  const detalhes = useMemo(() => {
    if (!consideracaoSelecionada) return []
    if (consideracaoSelecionada === SEM_REGISTRO_SENTINELA) {
      return listarEscoposSemRegistroSemana(escopos, semanaisPorEscopo, dataReferencia).map((escopo) => ({
        escopo,
        registro: null,
      }))
    }
    return listarEscoposPorConsideracaoSemana(escopos, semanaisPorEscopo, dataReferencia, consideracaoSelecionada)
  }, [escopos, semanaisPorEscopo, dataReferencia, consideracaoSelecionada])

  const maxConsideracao = Math.max(...stats.porConsideracao.map((item) => item.total), stats.semRegistro, 1)

  function handleClickConsideracao(valor) {
    setConsideracaoSelecionada((atual) => (atual === valor ? null : valor))
  }

  const naoValidada =
    totalPorConsideracao(stats, 'Não Validado Pelo Planejamento') +
    totalPorConsideracao(stats, 'Não Validado Pelo Especialista')

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Escopos Ativos" value={stats.totalEscoposAtivos} tone="neutral" />
        <StatCard
          label="Validações Finalizadas"
          value={totalPorConsideracao(stats, 'Validação Finalizada')}
          tone="success"
        />
        <StatCard
          label="Validação em Andamento"
          value={totalPorConsideracao(stats, 'Validação em Andamento')}
          tone="accent"
        />
        <StatCard label="Não Validada" value={naoValidada} tone="alert" />
        <StatCard
          label="Escopos em Validação Inicial"
          value={totalPorConsideracao(stats, 'Escopo em Validação Inicial')}
          tone="gold"
        />
      </div>

      <Card faixaCor="#2f6fed" categoria="Situação na data de referência" titulo="Escopos por consideração">
        <ol className="flex flex-col gap-2">
          {stats.porConsideracao.map((item) => {
            const selecionado = consideracaoSelecionada === item.valor
            return (
              <li key={item.valor}>
                <button
                  type="button"
                  onClick={() => handleClickConsideracao(item.valor)}
                  aria-pressed={selecionado}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    selecionado
                      ? 'border-accent bg-accent/10'
                      : 'border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-slate-600 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-navy dark:text-slate-100">{item.valor}</span>
                    <span className="font-semibold text-navy dark:text-slate-100">{item.total}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(item.total / maxConsideracao) * 100}%`,
                        backgroundColor: COR_CONSIDERACAO[item.valor] ?? '#2f6fed',
                      }}
                    />
                  </div>
                </button>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => handleClickConsideracao(SEM_REGISTRO_SENTINELA)}
              aria-pressed={consideracaoSelecionada === SEM_REGISTRO_SENTINELA}
              className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                consideracaoSelecionada === SEM_REGISTRO_SENTINELA
                  ? 'border-accent bg-accent/10'
                  : 'border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-slate-600 dark:hover:bg-slate-700/50'
              }`}
            >
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-slate-400">Sem registro nesta data</span>
                <span className="font-semibold text-navy dark:text-slate-100">{stats.semRegistro}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gray-400"
                  style={{ width: `${(stats.semRegistro / maxConsideracao) * 100}%` }}
                />
              </div>
            </button>
          </li>
        </ol>

        {consideracaoSelecionada && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between bg-gray-50 px-3 py-2 dark:bg-slate-700/50">
              <p className="text-sm font-medium text-navy dark:text-slate-100">
                {consideracaoSelecionada} ({detalhes.length})
              </p>
              <button
                type="button"
                onClick={() => setConsideracaoSelecionada(null)}
                className="text-xs font-medium text-accent hover:underline"
              >
                Fechar
              </button>
            </div>
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Empresa</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Escopo</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
                {detalhes.map(({ escopo, registro }) => (
                  <tr key={escopo.id}>
                    <td className="px-3 py-2 text-navy dark:text-slate-100">
                      <span className="font-medium">{escopo.empresa}</span>
                      {escopo.numero_contrato && (
                        <span className="font-medium"> (CT {escopo.numero_contrato})</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-slate-400">{escopo.escopo}</td>
                    <td className="px-3 py-2 text-navy dark:text-slate-100">{statusValidacaoRegistro(registro)}</td>
                  </tr>
                ))}
                {detalhes.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-gray-500 dark:text-slate-400">
                      Nenhum escopo encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function DashboardMensal({ escopos, semanaisPorEscopo, mesReferencia }) {
  const { quartas, linhas } = useMemo(
    () => computeValidacoesMatrizMensal(escopos, semanaisPorEscopo, mesReferencia),
    [escopos, semanaisPorEscopo, mesReferencia],
  )

  if (quartas.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-slate-400">
        Mês sem nenhuma quarta-feira (verifique o valor selecionado).
      </p>
    )
  }

  if (linhas.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum escopo ativo cadastrado.</p>
  }

  return (
    <Card faixaCor="#2f6fed" categoria="Cronograma do mês" titulo="Validação por quarta-feira">
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-700/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Escopo</th>
              {quartas.map((data) => (
                <th key={data} className="px-3 py-2 text-center font-medium text-gray-500 dark:text-slate-400">
                  {formatarDataBR(data)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
            {linhas.map(({ escopo, celulas }) => (
              <tr key={escopo.id}>
                <td className="px-3 py-2 text-navy dark:text-slate-100">
                  <span className="font-medium">{escopo.empresa}</span>
                  {escopo.numero_contrato && <span className="font-medium"> (CT {escopo.numero_contrato})</span>}
                  <span className="text-gray-400 dark:text-slate-500"> — {escopo.escopo}</span>
                </td>
                {celulas.map((celula) => (
                  <td key={celula.data} className="px-2 py-2 text-center">
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold leading-tight ${
                        celula.validado ? 'bg-success/10 text-success' : 'bg-alert/10 text-alert'
                      }`}
                    >
                      {celula.validado ? 'Cronograma Validado' : 'Cronograma Não Validado / Reprovado'}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/**
 * Aba "Dashboard": alterna entre modo Semanal (indicadores agregados na
 * data de referência EXATA — ver computeValidacoesStatsSemana) e modo
 * Mensal (matriz escopo × quarta-feira do mês — ver
 * computeValidacoesMatrizMensal). Recebe escopos/semanaisPorEscopo prontos
 * do pai (Validacoes.jsx), mesma fonte de dados da aba Data_Base.
 */
export default function ValidacoesDashboard({ escopos, semanaisPorEscopo }) {
  const [modo, setModo] = useState('semanal')
  // Padrão: quarta-feira mais recente (ver quartaFeiraMaisRecente) — dia
  // de envio semanal das empresas. Ajustável pelo próprio seletor.
  const [dataReferencia, setDataReferencia] = useState(() => quartaFeiraMaisRecente())
  const [mesReferencia, setMesReferencia] = useState(() => mesAtualISO())

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <ToggleModo modo={modo} onChange={setModo} />

        {modo === 'semanal' ? (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
            Data de referência
            <input
              type="date"
              value={dataReferencia}
              onChange={(event) => setDataReferencia(event.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
            />
          </label>
        ) : (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
            Mês de referência
            <input
              type="month"
              value={mesReferencia}
              onChange={(event) => setMesReferencia(event.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
            />
          </label>
        )}
      </div>

      {modo === 'semanal' ? (
        <DashboardSemanal escopos={escopos} semanaisPorEscopo={semanaisPorEscopo} dataReferencia={dataReferencia} />
      ) : (
        <DashboardMensal escopos={escopos} semanaisPorEscopo={semanaisPorEscopo} mesReferencia={mesReferencia} />
      )}
    </div>
  )
}
