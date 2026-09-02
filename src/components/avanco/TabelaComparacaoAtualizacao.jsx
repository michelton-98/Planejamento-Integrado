import { formatarPeso } from '../../lib/qualisoldaAgrupamento'
import { formatarPercentualIndicador } from './TabelaIndicadoresFortys'

// Tabela de itens que avançaram entre a data anterior e a atual (aba
// Atualização) — mesmas colunas pra isométricos, o resumo de Suportes e
// equipamentos/torres, só troca o rótulo da 1ª coluna (isométrico ou TAG).
// `itens` já vem no formato de saída de compararItens() (ver
// qualisoldaAgrupamento.js): { chave, percentualAnterior, percentualAtual,
// deltaPercentual, pesoExecutadoAnterior, pesoExecutadoAtual, deltaPeso }.
export default function TabelaComparacaoAtualizacao({ itens, rotuloColuna, mensagemVazio }) {
  if (itens.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400">{mensagemVazio}</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
        <thead className="bg-gray-50 dark:bg-slate-700/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">{rotuloColuna}</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">% Anterior</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">% Atual</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Δ%</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Peso Executado Anterior (kg)</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Peso Executado Atual (kg)</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Δ Peso (kg)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
          {itens.map((item) => (
            <tr key={item.chave}>
              <td className="px-3 py-2 text-navy dark:text-slate-100">{item.chave}</td>
              <td className="px-3 py-2 text-right text-gray-500 dark:text-slate-400">
                {formatarPercentualIndicador(item.percentualAnterior)}
              </td>
              <td className="px-3 py-2 text-right text-navy dark:text-slate-100">{formatarPercentualIndicador(item.percentualAtual)}</td>
              <td
                className={`px-3 py-2 text-right font-medium ${
                  item.deltaPercentual > 0 ? 'text-success' : item.deltaPercentual < 0 ? 'text-alert' : 'text-gray-400 dark:text-slate-500'
                }`}
              >
                {item.deltaPercentual >= 0 ? '+' : ''}
                {item.deltaPercentual.toFixed(1)} pp
              </td>
              <td className="px-3 py-2 text-right text-gray-500 dark:text-slate-400">{formatarPeso(item.pesoExecutadoAnterior)}</td>
              <td className="px-3 py-2 text-right text-navy dark:text-slate-100">{formatarPeso(item.pesoExecutadoAtual)}</td>
              <td className={`px-3 py-2 text-right font-medium ${item.deltaPeso >= 0 ? 'text-success' : 'text-alert'}`}>
                {item.deltaPeso >= 0 ? '+' : ''}
                {formatarPeso(item.deltaPeso)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
