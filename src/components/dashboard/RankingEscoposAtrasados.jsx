import { useMemo, useState } from 'react'
import { computeRankingEscoposAtrasados, filtrarPorTermoEscopo } from '../../lib/dashboardData'
import Card from '../Card'

const STATUS_LABEL = {
  pendente_contratada: 'Pendente contratada',
  pendente_especialista: 'Pendente especialista',
}

function formatarDataBR(data) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export default function RankingEscoposAtrasados({ rows, dataReferencia }) {
  const ranking = useMemo(
    () => computeRankingEscoposAtrasados(rows, dataReferencia, 10),
    [rows, dataReferencia],
  )
  const [termoSelecionado, setTermoSelecionado] = useState(null)

  const detalhes = useMemo(
    () => (termoSelecionado ? filtrarPorTermoEscopo(rows, termoSelecionado, dataReferencia) : []),
    [rows, termoSelecionado, dataReferencia],
  )

  const maxTotal = ranking[0]?.total ?? 0

  function handleClickTermo(termo) {
    setTermoSelecionado((atual) => (atual === termo ? null : termo))
  }

  return (
    <Card
      faixaCor="#2f6fed"
      categoria="Ranking"
      titulo="Termos de escopo mais recorrentes em atraso"
    >
      <p className="-mt-3 mb-4 text-xs text-gray-500">
        Termos extraídos do campo "Escopo" das pendências atrasadas (top 10).
      </p>

      {ranking.length === 0 ? (
        <p className="text-sm text-gray-500">Sem dados.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {ranking.map((item, indice) => {
            const selecionado = termoSelecionado === item.termo
            return (
              <li key={item.termo}>
                <button
                  type="button"
                  onClick={() => handleClickTermo(item.termo)}
                  aria-pressed={selecionado}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    selecionado
                      ? 'border-gold bg-gold/10'
                      : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-navy">
                      <span className="mr-2 text-gray-400">{indice + 1}.</span>
                      {capitalizar(item.termo)}
                    </span>
                    <span className="font-semibold text-navy">{item.total}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
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
      )}

      {termoSelecionado && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
          <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
            <p className="text-sm font-medium text-navy">
              RDOs atrasados com "{termoSelecionado}" no escopo ({detalhes.length})
            </p>
            <button
              type="button"
              onClick={() => setTermoSelecionado(null)}
              className="text-xs font-medium text-accent hover:underline"
            >
              Fechar
            </button>
          </div>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Contrato</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Data do RDO</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Escopo</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Empresa</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Responsável</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {detalhes.map((linha, indice) => (
                <tr key={indice}>
                  <td className="px-3 py-2 text-navy">{linha.numero_contrato || '—'}</td>
                  <td className="px-3 py-2 text-navy">{formatarDataBR(linha.data_relatorio)}</td>
                  <td className="px-3 py-2 text-navy">{linha.escopo || '—'}</td>
                  <td className="px-3 py-2 text-navy">{linha.empresa || '—'}</td>
                  <td className="px-3 py-2 text-navy">{linha.responsavel_nome || '—'}</td>
                  <td className="px-3 py-2 text-navy">
                    {STATUS_LABEL[linha.status_aprovacao] ?? '—'}
                  </td>
                </tr>
              ))}
              {detalhes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
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
