import { useMemo, useState } from 'react'
import { computeHeatmapDias, filtrarPorData, nivelHeatmap } from '../../lib/dashboardData'
import Card from '../Card'

// Rampa sequencial de um hue só (azul médio da marca), do mais claro ao
// mais intenso — segue a regra do skill de dataviz para magnitude
// ("sequential = one hue, light→dark"), não é uma paleta categórica.
const CORES_NIVEL = ['#ebedf0', '#c6dcfd', '#8fb8fa', '#5a8ff5', '#2f6fed']

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
      <p className="-mt-3 mb-4 text-xs text-gray-500">
        Contagem por data do RDO. Passe o mouse (ou toque) num dia para ver o total; clique para ver
        a lista.
      </p>

      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-[3px]">
          {semanas.map((semana, indiceSemana) => {
            const primeiroDiaValido = semana.find((d) => d.dentroDoIntervalo)
            let rotuloMes = null
            if (primeiroDiaValido && primeiroDiaValido.mes !== ultimoMesRotulado) {
              rotuloMes = NOMES_MES[primeiroDiaValido.mes]
              ultimoMesRotulado = primeiroDiaValido.mes
            }

            return (
              <div key={indiceSemana} className="flex flex-col gap-[3px]">
                <div className="h-3 text-[10px] leading-3 text-gray-400">{rotuloMes ?? ''}</div>
                {semana.map((dia) => {
                  if (!dia.dentroDoIntervalo) {
                    return <div key={dia.data} className="h-[11px] w-[11px]" />
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
                      className="h-[11px] w-[11px] rounded-sm transition-transform hover:scale-125 focus:scale-125 focus:outline-none"
                      style={{
                        backgroundColor: CORES_NIVEL[nivel],
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
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs shadow-sm"
          style={{ left: tooltip.x, top: tooltip.y - 6 }}
        >
          <span className="font-medium text-navy">{formatarDataBR(tooltip.data)}</span>
          <span className="text-gray-600"> — {tooltip.contagem} RDO(s)</span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
        <span>Menos</span>
        {CORES_NIVEL.map((cor) => (
          <span key={cor} className="h-[11px] w-[11px] rounded-sm" style={{ backgroundColor: cor }} />
        ))}
        <span>Mais</span>
      </div>

      {diaSelecionado && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
          <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
            <p className="text-sm font-medium text-navy">
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
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Empresa</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Escopo</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {linhasDoDia.map((linha, indice) => (
                <tr key={indice}>
                  <td className="px-3 py-2 text-navy">{linha.empresa || '—'}</td>
                  <td className="px-3 py-2 text-navy">{linha.escopo || '—'}</td>
                  <td className="px-3 py-2 text-navy">
                    {STATUS_LABEL[linha.status_aprovacao] ?? '—'}
                  </td>
                </tr>
              ))}
              {linhasDoDia.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
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
