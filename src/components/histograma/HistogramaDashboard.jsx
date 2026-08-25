import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  curvaTemporal,
  dataMaisRecente,
  kpisGerais,
  porDisciplina,
  rankingAderencia,
} from '../../lib/histogramaData'
import { useTheme } from '../../lib/ThemeContext'
import Card from '../Card'
import StatCard from '../dashboard/StatCard'

function formatarDataBR(dataISO) {
  if (!dataISO) return '—'
  const [, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}`
}

function formatarDataCompletaBR(dataISO) {
  if (!dataISO) return '—'
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

// Cor de cada série da curva — mesma paleta semântica do resto do app:
// navy (previsto, base/neutro), accent (realizado, o que de fato aconteceu)
// e gold (projeção, estimativa). Uma legenda é obrigatória aqui (3 séries
// no mesmo gráfico, ver skill dataviz).
const COR_PREVISTO = '#12263f'
const COR_REALIZADO = '#2f6fed'
const COR_PROJECAO = '#a9791f'

function TooltipCurva({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-600 dark:bg-slate-700">
      <p className="mb-1 font-medium text-navy dark:text-slate-100">{formatarDataCompletaBR(label)}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="text-gray-600 dark:text-slate-300">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{' '}
          {item.name}: <span className="font-semibold text-navy dark:text-slate-100">{item.value}</span>
        </p>
      ))}
    </div>
  )
}

function CurvaTemporal({ linhas }) {
  const { tema } = useTheme()
  const escuro = tema === 'dark'
  const dados = useMemo(() => curvaTemporal(linhas), [linhas])

  return (
    <Card faixaCor="#0891b2" categoria="Histórico" titulo="Curva de efetivo ao longo do tempo">
      {dados.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Sem dados cadastrados ainda.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dados} margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={escuro ? '#334155' : '#e5e7eb'} vertical={false} />
            <XAxis
              dataKey="data"
              tickFormatter={formatarDataBR}
              tick={{ fill: escuro ? '#cbd5e1' : '#374151', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: escuro ? '#cbd5e1' : '#374151', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<TooltipCurva />} cursor={{ stroke: escuro ? '#475569' : '#d1d5db' }} />
            <Legend wrapperStyle={{ fontSize: 12, color: escuro ? '#cbd5e1' : '#374151' }} />
            <Line type="monotone" dataKey="previsto" name="Previsto" stroke={COR_PREVISTO} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="realizado" name="Realizado" stroke={COR_REALIZADO} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="projecao" name="Projeção" stroke={COR_PROJECAO} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

function PorDisciplina({ linhasDataMaisRecente }) {
  const dados = useMemo(() => porDisciplina(linhasDataMaisRecente), [linhasDataMaisRecente])
  const maximo = Math.max(...dados.flatMap((item) => [item.previsto, item.realizado]), 1)

  return (
    <Card faixaCor="#0891b2" categoria="Por disciplina" titulo="Previsto x Realizado">
      <div className="flex flex-col gap-3">
        {dados.map((item) => (
          <div key={item.disciplina}>
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
              <span>{item.disciplina}</span>
              <span className="font-medium text-navy dark:text-slate-100">
                {item.realizado} / {item.previsto}
              </span>
            </div>
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full"
                style={{ width: `${(item.previsto / maximo) * 100}%`, backgroundColor: COR_PREVISTO, opacity: 0.35 }}
              />
            </div>
            <div className="-mt-2.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
              <div className="h-full rounded-full" style={{ width: `${(item.realizado / maximo) * 100}%`, backgroundColor: COR_REALIZADO }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-4 text-[11px] text-gray-400 dark:text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COR_PREVISTO, opacity: 0.35 }} /> Previsto
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COR_REALIZADO }} /> Realizado
        </span>
      </p>
    </Card>
  )
}

// Ranking de aderência por Empresa/Disciplina, pior primeiro — mesmo
// espírito visual dos "Top 5" do Controle de RDO (ver TopBarChart.jsx),
// aqui como tabela (mais colunas por linha do que um gráfico de barras
// comporta: Empresa, Disciplina, Previsto, Realizado, % Aderência).
function RankingAderencia({ linhasDataMaisRecente }) {
  const dados = useMemo(() => rankingAderencia(linhasDataMaisRecente), [linhasDataMaisRecente])

  return (
    <Card faixaCor="#0891b2" categoria="Ranking" titulo="Aderência por empresa (pior → melhor)">
      {dados.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Sem dados com Previsto informado nesta data.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Empresa</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Disciplina</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Previsto</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Realizado</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">% Aderência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
              {dados.map((item) => (
                <tr key={`${item.empresa}|${item.disciplina}`}>
                  <td className="px-3 py-2 font-medium text-navy dark:text-slate-100">{item.empresa}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-slate-400">{item.disciplina}</td>
                  <td className="px-3 py-2 text-right text-navy dark:text-slate-100">{item.previsto}</td>
                  <td className="px-3 py-2 text-right text-navy dark:text-slate-100">{item.realizado}</td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${
                      item.aderencia < 70 ? 'text-alert' : item.aderencia < 90 ? 'text-gold' : 'text-success'
                    }`}
                  >
                    {item.aderencia}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/**
 * Aba "Dashboard": KPIs gerais da data mais recente cadastrada, curva
 * histórica (todas as datas), quebra por disciplina e ranking de aderência
 * por empresa — tudo derivado de `linhasTodas` (já carregado pelo pai, ver
 * Histograma.jsx), sem fetch próprio.
 */
export default function HistogramaDashboard({ linhasTodas }) {
  const maisRecente = useMemo(() => dataMaisRecente(linhasTodas), [linhasTodas])
  const linhasDataMaisRecente = useMemo(
    () => linhasTodas.filter((linha) => linha.data_referencia === maisRecente),
    [linhasTodas, maisRecente],
  )
  const kpis = useMemo(() => kpisGerais(linhasDataMaisRecente), [linhasDataMaisRecente])

  if (linhasTodas.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum efetivo cadastrado ainda — envie um .csv na aba Input.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gray-400 dark:text-slate-500">
        Data de referência mais recente: <span className="font-medium text-navy dark:text-slate-100">{formatarDataCompletaBR(maisRecente)}</span>
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Previsto" value={kpis.previsto} tone="neutral" />
        <StatCard label="Realizado" value={kpis.realizado} tone="accent" />
        <StatCard label="Projeção" value={kpis.projecao} tone="gold" />
        <StatCard label="Índice de Aderência Geral" value={`${kpis.aderencia}%`} tone={kpis.aderencia < 90 ? 'alert' : 'success'} />
      </div>

      <CurvaTemporal linhas={linhasTodas} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PorDisciplina linhasDataMaisRecente={linhasDataMaisRecente} />
        <RankingAderencia linhasDataMaisRecente={linhasDataMaisRecente} />
      </div>
    </div>
  )
}
