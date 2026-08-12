import { useMemo, useState } from 'react'
import {
  computeValidacoesMatrizMensal,
  computeValidacoesStatsSemana,
  mesAtualISO,
  quartaFeiraMaisRecente,
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
  const stats = useMemo(
    () => computeValidacoesStatsSemana(escopos, semanaisPorEscopo, dataReferencia),
    [escopos, semanaisPorEscopo, dataReferencia],
  )

  const maxConsideracao = Math.max(...stats.porConsideracao.map((item) => item.total), stats.semRegistro, 1)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Escopos ativos" value={stats.totalEscoposAtivos} tone="neutral" />
        <StatCard label="Validação completa" value={stats.completos} tone="success" />
        <StatCard label="Validação incompleta" value={stats.incompletos} tone="accent" />
        <StatCard label="Sem registro nesta data" value={stats.semRegistro} tone="alert" />
      </div>

      <Card faixaCor="#2f6fed" categoria="Situação na data de referência" titulo="Escopos por consideração">
        <ol className="flex flex-col gap-2">
          {stats.porConsideracao.map((item) => (
            <li key={item.valor}>
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
            </li>
          ))}
          <li>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-gray-500">Sem registro nesta data</span>
              <span className="font-semibold text-navy">{stats.semRegistro}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gray-400"
                style={{ width: `${(stats.semRegistro / maxConsideracao) * 100}%` }}
              />
            </div>
          </li>
        </ol>
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
    <Card faixaCor="#2f6fed" categoria="Cronograma do mês" titulo="Validação por quarta-feira" contentClassName="overflow-x-auto p-0">
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
