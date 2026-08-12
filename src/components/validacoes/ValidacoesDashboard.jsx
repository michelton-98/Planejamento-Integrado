import { useMemo } from 'react'
import { computeValidacoesStats } from '../../lib/validacoesData'
import Card from '../Card'
import StatCard from '../dashboard/StatCard'

// Cores por consideração — mesma paleta usada no resto do app (accent =
// informativo, alert = problema, gold = atenção, success = positivo).
const COR_CONSIDERACAO = {
  'Não Validado Pelo Planejamento': '#d1495b',
  'Não Validado Pelo Especialista': '#d1495b',
  'Validação Finalizada': '#178a54',
  'Escopo em Validação Inicial': '#a9791f',
  'Falha nos entregáveis semanais': '#d1495b',
}

/**
 * Aba "Dashboard/Resumo": indicadores agregados olhando sempre a
 * validação semanal mais recente de cada escopo ATIVO (nunca o histórico
 * inteiro nem escopos concluídos/paralisados) — ver computeValidacoesStats.
 * Recebe escopos/semanaisPorEscopo prontos do pai (Validacoes.jsx), mesma
 * fonte de dados da aba Data_Base.
 */
export default function ValidacoesDashboard({ escopos, semanaisPorEscopo }) {
  const stats = useMemo(
    () => computeValidacoesStats(escopos, semanaisPorEscopo),
    [escopos, semanaisPorEscopo],
  )

  const maxConsideracao = Math.max(...stats.porConsideracao.map((item) => item.total), stats.semRegistro, 1)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Escopos ativos" value={stats.totalEscoposAtivos} tone="neutral" />
        <StatCard label="Validação completa" value={stats.completos} tone="success" />
        <StatCard label="Validação incompleta" value={stats.incompletos} tone="accent" />
        <StatCard label="Sem validação registrada" value={stats.semRegistro} tone="alert" />
      </div>

      <Card faixaCor="#2f6fed" categoria="Situação atual" titulo="Escopos por consideração (mais recente)">
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
              <span className="text-gray-500">Sem validação registrada</span>
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
