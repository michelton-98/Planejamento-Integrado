import { useMemo, useState } from 'react'
import {
  computeValidacoesMatrizMensal,
  computeValidacoesStatsSemana,
  listarEscoposPorConsideracaoSemana,
  mesAtualISO,
  quartaFeiraMaisRecente,
  statusValidacaoRegistro,
} from '../../lib/validacoesData'
import Card from '../Card'
import StatCard from '../dashboard/StatCard'

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

// Toggle "estilo liga-desliga" com os dois rótulos flanqueando a chave —
// Semanal à esquerda, Mensal à direita.
function ToggleModo({ modo, onChange }) {
  const semanal = modo === 'semanal'
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <span className={semanal ? 'text-navy' : 'text-gray-400'}>Semanal</span>
      <button
        type="button"
        role="switch"
        aria-checked={!semanal}
        onClick={() => onChange(semanal ? 'mensal' : 'semanal')}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          semanal ? 'bg-gray-300' : 'bg-accent'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            semanal ? 'translate-x-0' : 'translate-x-5'
          }`}
        />
      </button>
      <span className={!semanal ? 'text-navy' : 'text-gray-400'}>Mensal</span>
    </div>
  )
}

function DashboardSemanal({ escopos, semanaisPorEscopo, dataReferencia }) {
  const [consideracaoSelecionada, setConsideracaoSelecionada] = useState(null)

  const stats = useMemo(
    () => computeValidacoesStatsSemana(escopos, semanaisPorEscopo, dataReferencia),
    [escopos, semanaisPorEscopo, dataReferencia],
  )

  const detalhes = useMemo(
    () =>
      consideracaoSelecionada
        ? listarEscoposPorConsideracaoSemana(escopos, semanaisPorEscopo, dataReferencia, consideracaoSelecionada)
        : [],
    [escopos, semanaisPorEscopo, dataReferencia, consideracaoSelecionada],
  )

  const maxConsideracao = Math.max(...stats.porConsideracao.map((item) => item.total), stats.semRegistro, 1)

  function handleClickConsideracao(valor) {
    setConsideracaoSelecionada((atual) => (atual === valor ? null : valor))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Escopos ativos" value={stats.totalEscoposAtivos} tone="neutral" />
        <StatCard label="Validação completa" value={stats.completos} tone="success" />
        <StatCard label="Validação em Andamento" value={stats.incompletos} tone="accent" />
        <StatCard label="Sem registro nesta data" value={stats.semRegistro} tone="alert" />
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
                    selecionado ? 'border-accent bg-accent/10' : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-navy">{item.valor}</span>
                    <span className="font-semibold text-navy">{item.total}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
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
            <div className="mb-1 flex items-center justify-between px-3 text-sm">
              <span className="text-gray-500">Sem registro nesta data</span>
              <span className="font-semibold text-navy">{stats.semRegistro}</span>
            </div>
            <div className="mx-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gray-400"
                style={{ width: `${(stats.semRegistro / maxConsideracao) * 100}%` }}
              />
            </div>
          </li>
        </ol>

        {consideracaoSelecionada && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
            <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
              <p className="text-sm font-medium text-navy">
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
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Empresa</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Escopo</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {detalhes.map(({ escopo, registro }) => (
                  <tr key={escopo.id}>
                    <td className="px-3 py-2 text-navy">
                      <span className="font-medium">{escopo.empresa}</span>
                      {escopo.numero_contrato && (
                        <span className="font-medium"> (CT {escopo.numero_contrato})</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{escopo.escopo}</td>
                    <td className="px-3 py-2 text-navy">{statusValidacaoRegistro(registro)}</td>
                  </tr>
                ))}
                {detalhes.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
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
    return <p className="text-sm text-gray-500">Mês sem nenhuma quarta-feira (verifique o valor selecionado).</p>
  }

  if (linhas.length === 0) {
    return <p className="text-sm text-gray-500">Nenhum escopo ativo cadastrado.</p>
  }

  return (
    <Card faixaCor="#2f6fed" categoria="Cronograma do mês" titulo="Validação por quarta-feira">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Escopo</th>
              {quartas.map((data) => (
                <th key={data} className="px-3 py-2 text-center font-medium text-gray-500">
                  {formatarDataBR(data)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {linhas.map(({ escopo, celulas }) => (
              <tr key={escopo.id}>
                <td className="px-3 py-2 text-navy">
                  <span className="font-medium">{escopo.empresa}</span>
                  {escopo.numero_contrato && <span className="font-medium"> (CT {escopo.numero_contrato})</span>}
                  <span className="text-gray-400"> — {escopo.escopo}</span>
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
        <ToggleModo modo={modo} onChange={setModo} />

        {modo === 'semanal' ? (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Data de referência
            <input
              type="date"
              value={dataReferencia}
              onChange={(event) => setDataReferencia(event.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-accent focus:outline-none"
            />
          </label>
        ) : (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Mês de referência
            <input
              type="month"
              value={mesReferencia}
              onChange={(event) => setMesReferencia(event.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-accent focus:outline-none"
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
