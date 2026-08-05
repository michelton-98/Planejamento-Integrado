import { useMemo } from 'react'
import { computeNomesComContagem, filtrarPorNome } from '../../lib/dashboardData'
import Card from '../Card'

function formatarData(data) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
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
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      No prazo
    </span>
  )
}

// Componente controlado: `tipo`/`selecionado` vêm de fora (Home.jsx) para
// que os gráficos Top 5 possam sincronizar a seleção — clicar numa barra lá
// muda o toggle e a seleção aqui, sem duplicar esse estado.
export default function DrilldownExplorer({
  rows,
  dataReferencia,
  tipo,
  selecionado,
  onTipoChange,
  onSelecionadoChange,
}) {
  const nomes = useMemo(() => computeNomesComContagem(rows, tipo), [rows, tipo])
  const detalhes = useMemo(
    () => (selecionado ? filtrarPorNome(rows, tipo, selecionado, dataReferencia) : []),
    [rows, tipo, selecionado, dataReferencia],
  )

  function handleTipoChange(novoTipo) {
    if (novoTipo === tipo) return
    onTipoChange(novoTipo)
    onSelecionadoChange(null)
  }

  const colunaOutro = tipo === 'contratada' ? 'Especialista' : 'Contratada'

  return (
    <Card faixaCor="#12263f" categoria="Explorador">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-navy">Explorar pendências</h3>

        <div className="inline-flex rounded-md border border-gray-200 p-0.5" role="group">
          <button
            type="button"
            onClick={() => handleTipoChange('contratada')}
            aria-pressed={tipo === 'contratada'}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              tipo === 'contratada'
                ? 'bg-accent text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Contratada
          </button>
          <button
            type="button"
            onClick={() => handleTipoChange('especialista')}
            aria-pressed={tipo === 'especialista'}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              tipo === 'especialista'
                ? 'bg-accent text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Especialista
          </button>
        </div>
      </div>

      {nomes.length === 0 ? (
        <p className="text-sm text-gray-500">Sem dados.</p>
      ) : (
        <ul className="mb-4 flex flex-wrap gap-2">
          {nomes.map(({ nome, total }) => (
            <li key={nome}>
              <button
                type="button"
                onClick={() => onSelecionadoChange(nome)}
                aria-pressed={selecionado === nome}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  selecionado === nome
                    ? 'border-gold bg-gold/10 font-medium text-navy'
                    : 'border-gray-200 text-gray-700 hover:border-accent hover:text-accent'
                }`}
              >
                {nome} <span className="text-gray-400">({total})</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selecionado && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Contrato</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Data do RDO</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Prazo</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Escopo</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">{colunaOutro}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {detalhes.map((linha, index) => (
                <tr key={index}>
                  <td className="px-3 py-2 text-navy">{linha.numero_contrato || '—'}</td>
                  <td className="px-3 py-2 text-navy">{formatarData(linha.data_relatorio)}</td>
                  <td className="px-3 py-2">
                    <PrazoBadge prazo={linha.prazo} />
                  </td>
                  <td className="px-3 py-2 text-navy">{linha.escopo || '—'}</td>
                  <td className="px-3 py-2 text-navy">{linha.outro || '—'}</td>
                </tr>
              ))}
              {detalhes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
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
