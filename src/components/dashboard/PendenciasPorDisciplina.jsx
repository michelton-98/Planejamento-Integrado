import { useMemo, useState } from 'react'
import { computePendenciasPorDisciplina, filtrarPorDisciplina } from '../../lib/dashboardData'
import Card from '../Card'

function formatarDataBR(data) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

const SUFIXO_STATUS = {
  pendente_contratada: '(Contratada)',
  pendente_especialista: '(Inpasa)',
}

function PrazoBadge({ prazo }) {
  if (prazo === 'atrasado') {
    return (
      <span className="inline-flex items-center rounded-full bg-alert/10 px-2 py-0.5 text-xs font-medium text-alert">
        Atrasado
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-slate-700 dark:text-slate-300">
      No prazo
    </span>
  )
}

// rows deve vir já filtrado para obras "em andamento" (filtrarRdosEmAndamento).
export default function PendenciasPorDisciplina({ rows, dataReferencia }) {
  const ranking = useMemo(() => computePendenciasPorDisciplina(rows), [rows])
  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState(null)

  const detalhes = useMemo(
    () =>
      disciplinaSelecionada
        ? filtrarPorDisciplina(rows, disciplinaSelecionada, dataReferencia)
        : [],
    [rows, disciplinaSelecionada, dataReferencia],
  )

  const maxTotal = Math.max(...ranking.map((item) => item.total), 0)

  function handleClickDisciplina(disciplina) {
    setDisciplinaSelecionada((atual) => (atual === disciplina ? null : disciplina))
  }

  return (
    <Card faixaCor="#2f6fed" categoria="Ranking" titulo="Pendências por Disciplina">
      <ol className="flex flex-col gap-2">
        {ranking.map((item) => {
          const selecionado = disciplinaSelecionada === item.disciplina
          return (
            <li key={item.disciplina}>
              <button
                type="button"
                onClick={() => handleClickDisciplina(item.disciplina)}
                aria-pressed={selecionado}
                className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                  selecionado
                    ? 'border-gold bg-gold/10'
                    : 'border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-slate-600 dark:hover:bg-slate-700/50'
                }`}
              >
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-navy dark:text-slate-100">{item.disciplina}</span>
                  <span className="font-semibold text-navy dark:text-slate-100">{item.total}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${maxTotal ? (item.total / maxTotal) * 100 : 0}%` }}
                  />
                </div>
              </button>
            </li>
          )
        })}
      </ol>

      {disciplinaSelecionada && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 print:hidden dark:border-slate-700">
          <div className="flex items-center justify-between bg-gray-50 px-3 py-2 dark:bg-slate-700/50">
            <p className="text-sm font-medium text-navy dark:text-slate-100">
              Pendências de {disciplinaSelecionada} ({detalhes.length})
            </p>
            <button
              type="button"
              onClick={() => setDisciplinaSelecionada(null)}
              className="text-xs font-medium text-accent hover:underline"
            >
              Fechar
            </button>
          </div>
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Contrato</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Data do RDO</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Empresa - Escopo</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Responsável</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
              {detalhes.map((linha, indice) => (
                <tr key={indice}>
                  <td className="px-3 py-2 text-navy dark:text-slate-100">{linha.numero_contrato || '—'}</td>
                  <td className="px-3 py-2 text-navy dark:text-slate-100">{formatarDataBR(linha.data_relatorio)}</td>
                  <td className="px-3 py-2 text-navy dark:text-slate-100">
                    <strong>{linha.empresa || '—'}</strong>
                    {linha.escopo ? ` — ${linha.escopo}` : ''}
                  </td>
                  <td className="px-3 py-2 text-navy dark:text-slate-100">
                    {linha.responsavel_nome || '—'}
                    {SUFIXO_STATUS[linha.status_aprovacao] && (
                      <span className="ml-1 text-gray-400 dark:text-slate-500">
                        {SUFIXO_STATUS[linha.status_aprovacao]}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <PrazoBadge prazo={linha.prazo} />
                  </td>
                </tr>
              ))}
              {detalhes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500 dark:text-slate-400">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
