import { useMemo, useState } from 'react'
import { computeHeatmapDias, filtrarPorData, nivelHeatmap } from '../../lib/dashboardData'
import { useTheme } from '../../lib/ThemeContext'
import Card from '../Card'

// Rampa sequencial de um hue só (azul médio da marca), do mais claro ao
// mais intenso — segue a regra do skill de dataviz para magnitude
// ("sequential = one hue, light→dark"), não é uma paleta categórica. Cores
// inline (SVG/estilo, não Tailwind), então o nível 0 (quase invisível no
// claro, de propósito) ganha uma variante escura pra continuar visível
// como "célula vazia" sobre o card escuro.
const CORES_NIVEL = ['#ebedf0', '#c6dcfd', '#8fb8fa', '#5a8ff5', '#2f6fed']
const CORES_NIVEL_ESCURO = ['#334155', '#1d4ed8', '#2f6fed', '#5a8ff5', '#8fb8fa']

const STATUS_LABEL = {
  pendente_contratada: 'Pendente contratada',
  pendente_especialista: 'Pendente especialista',
}

function formatarDataBR(chave) {
  const [ano, mes, dia] = chave.split('-')
  return `${dia}/${mes}/${ano}`
}

const NOMES_MES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

export default function VolumeHeatmap({ rows, dataReferencia }) {
  const { tema } = useTheme()
  const cores = tema === 'dark' ? CORES_NIVEL_ESCURO : CORES_NIVEL
  const dias = useMemo(() => computeHeatmapDias(rows, dataReferencia, 90), [rows, dataReferencia])
  const maxContagem = useMemo(
    () => dias.reduce((max, dia) => (dia.dentroDoIntervalo && dia.contagem > max ? dia.contagem : max), 0),
    [dias],
  )

  const semanas = []
  for (let i = 0; i < dias.length; i += 7) {
    semanas.push(dias.slice(i, i + 7))
  }

  const [tooltip, setTooltip] = useState(null) // { x, y, data, contagem }
  const [diaSelecionado, setDiaSelecionado] = useState(null)

  const linhasDoDia = useMemo(
    () => (diaSelecionado ? filtrarPorData(rows, diaSelecionado) : []),
    [rows, diaSelecionado],
  )

  function handleClickDia(chaveData) {
    setDiaSelecionado((atual) => (atual === chaveData ? null : chaveData))
  }

  // Rótulo de mês só na primeira semana em que o mês aparece, para não
  // repetir a cada coluna.
  let ultimoMesRotulado = -1

  return (
    <Card faixaCor="#2f6fed" categoria="Volume" titulo="Volume de RDOs recebidos — últimos ~90 dias">
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-[6px]">
          {semanas.map((semana, indiceSemana) => {
            const primeiroDiaValido = semana.find((d) => d.dentroDoIntervalo)
            let rotuloMes = null
            if (primeiroDiaValido && primeiroDiaValido.mes !== ultimoMesRotulado) {
              rotuloMes = NOMES_MES[primeiroDiaValido.mes]
              ultimoMesRotulado = primeiroDiaValido.mes
            }

            return (
              <div key={indiceSemana} className="flex flex-col gap-[6px]">
                <div className="h-5 text-xs leading-5 text-gray-400 dark:text-slate-500">{rotuloMes ?? ''}</div>
                {semana.map((dia) => {
                  if (!dia.dentroDoIntervalo) {
                    return <div key={dia.data} className="h-5 w-5" />
                  }

                  const nivel = nivelHeatmap(dia.contagem, maxContagem)
                  const selecionado = diaSelecionado === dia.data

                  return (
                    <button
                      key={dia.data}
                      type="button"
                      onClick={() => handleClickDia(dia.data)}
                      onMouseEnter={(evento) => {
                        const rect = evento.currentTarget.getBoundingClientRect()
                        setTooltip({
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                          data: dia.data,
                          contagem: dia.contagem,
                        })
                      }}
                      onFocus={(evento) => {
                        const rect = evento.currentTarget.getBoundingClientRect()
                        setTooltip({
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                          data: dia.data,
                          contagem: dia.contagem,
                        })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onBlur={() => setTooltip(null)}
                      aria-label={`${formatarDataBR(dia.data)}: ${dia.contagem} RDO(s)`}
                      aria-pressed={selecionado}
                      className="h-5 w-5 rounded-sm transition-transform hover:scale-110 focus:scale-110 focus:outline-none"
                      style={{
                        backgroundColor: cores[nivel],
                        boxShadow: selecionado ? '0 0 0 2px #a9791f' : 'none',
                      }}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-700"
          style={{ left: tooltip.x, top: tooltip.y - 6 }}
        >
          <span className="font-medium text-navy dark:text-slate-100">{formatarDataBR(tooltip.data)}</span>
          <span className="text-gray-600 dark:text-slate-300"> — {tooltip.contagem} RDO(s)</span>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500">
        <span>Menos</span>
        {cores.map((cor) => (
          <span key={cor} className="h-5 w-5 rounded-sm" style={{ backgroundColor: cor }} />
        ))}
        <span>Mais</span>
      </div>

      {diaSelecionado && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between bg-gray-50 px-3 py-2 dark:bg-slate-700/50">
            <p className="text-sm font-medium text-navy dark:text-slate-100">
              RDOs de {formatarDataBR(diaSelecionado)} ({linhasDoDia.length})
            </p>
            <button
              type="button"
              onClick={() => setDiaSelecionado(null)}
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
              {linhasDoDia.map((linha, indice) => (
                <tr key={indice}>
                  <td className="px-3 py-2 text-navy dark:text-slate-100">{linha.empresa || '—'}</td>
                  <td className="px-3 py-2 text-navy dark:text-slate-100">{linha.escopo || '—'}</td>
                  <td className="px-3 py-2 text-navy dark:text-slate-100">
                    {STATUS_LABEL[linha.status_aprovacao] ?? '—'}
                  </td>
                </tr>
              ))}
              {linhasDoDia.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-gray-500 dark:text-slate-400">
                    Nenhum RDO nesta data.
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
