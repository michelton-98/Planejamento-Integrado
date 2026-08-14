import { INDICADORES_FORTYS } from '../../lib/avancoIntegradoConfig'

/** '—' pra indicador sem dado (Fase II incompleta) ou % vazio; senão "45.5%". */
export function formatarPercentualIndicador(valor) {
  if (valor === null || valor === undefined) return '—'
  return `${Number(valor).toFixed(1)}%`
}

/**
 * Tabela dos 6 indicadores fixos extraídos do cronograma da FORTYS (ver
 * fortysXmlParse.js) — sempre mostra as 6 linhas na ordem de
 * INDICADORES_FORTYS, com '—' pros que não foram encontrados no arquivo
 * (só acontece pra Destilaria Fase II, que não bloqueia upload por
 * indicador faltante). Compartilhada entre AvancoDashboard e
 * AvancoDataBase pra não duplicar o mesmo markup.
 */
export default function TabelaIndicadoresFortys({ indicadores }) {
  const porNome = new Map(indicadores.map((item) => [item.nome_indicador, item]))

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
        <thead className="bg-gray-50 dark:bg-slate-700/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Indicador</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">% Previsto</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">% Executado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
          {INDICADORES_FORTYS.map((nome) => {
            const item = porNome.get(nome)
            return (
              <tr key={nome}>
                <td className="px-3 py-2 text-navy dark:text-slate-100">{nome}</td>
                <td className="px-3 py-2 text-right text-navy dark:text-slate-100">
                  {formatarPercentualIndicador(item?.percentual_previsto)}
                </td>
                <td className="px-3 py-2 text-right text-navy dark:text-slate-100">
                  {formatarPercentualIndicador(item?.percentual_executado)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
