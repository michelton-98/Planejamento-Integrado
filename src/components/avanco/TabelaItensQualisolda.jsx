import { useMemo, useState } from 'react'
import { formatarPeso } from '../../lib/qualisoldaAgrupamento'
import { SUPORTES_LABEL } from '../../lib/qualisoldaXlsxParse'
import { formatarPercentualIndicador } from './TabelaIndicadoresFortys'

// Tabelas de itens extraídos dos .xlsx da QUALISOLDA (ver migration 0024 e
// qualisoldaXlsxParse.js) — compartilhadas entre AvancoDataBase e
// AvancoDashboard (embora o Dashboard só use os agregados, não estas
// tabelas — ver PARTE 3 do prompt original: "Dashboard: só os agregados").

const CLASSE_BUSCA =
  'w-full max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100'

/**
 * Tabela de isométricos + a linha "resumo" de Suportes (destacada) de UM
 * material (Carbono OU Inox) — `itens` já vem filtrado pro material certo
 * (ver AvancoDataBase.jsx). Campo de busca por nome do isométrico (só
 * client-side, ~280 itens no máximo).
 */
export default function TabelaItensQualisolda({ itens }) {
  const [busca, setBusca] = useState('')

  const itensFiltrados = useMemo(() => {
    const alvo = busca.trim().toLowerCase()
    if (!alvo) return itens
    return itens.filter((item) => (item.isometrico ?? '').toLowerCase().includes(alvo))
  }, [itens, busca])

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={busca}
        onChange={(event) => setBusca(event.target.value)}
        placeholder="Buscar por isométrico..."
        className={CLASSE_BUSCA}
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-700/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Isométrico</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Área</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">∅</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Peso Total (kg)</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">% Fabricação</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">% Montagem</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">% Pintura</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">% Total</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Peso Executado (kg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
            {itensFiltrados.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center text-gray-400 dark:text-slate-500">
                  Nenhum item encontrado.
                </td>
              </tr>
            ) : (
              itensFiltrados.map((item) => {
                const ehResumoSuportes = item.tipo_registro === 'suporte_resumo'
                return (
                  <tr
                    key={item.id}
                    className={ehResumoSuportes ? 'bg-accent/10 font-semibold dark:bg-accent/20' : undefined}
                  >
                    <td className="px-3 py-2 text-navy dark:text-slate-100">
                      {item.isometrico ?? SUPORTES_LABEL[item.material]}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-slate-400">{item.area ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-500 dark:text-slate-400">{item.diametro ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-navy dark:text-slate-100">{formatarPeso(item.peso_total)}</td>
                    <td className="px-3 py-2 text-right text-navy dark:text-slate-100">
                      {formatarPercentualIndicador(item.percentual_fabricacao)}
                    </td>
                    <td className="px-3 py-2 text-right text-navy dark:text-slate-100">
                      {formatarPercentualIndicador(item.percentual_montagem)}
                    </td>
                    <td className="px-3 py-2 text-right text-navy dark:text-slate-100">
                      {formatarPercentualIndicador(item.percentual_pintura)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-accent">
                      {formatarPercentualIndicador(item.percentual_total)}
                    </td>
                    <td className="px-3 py-2 text-right text-navy dark:text-slate-100">{formatarPeso(item.peso_executado)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Tabela de "MC Equipamentos" (só existe no escopo Inox) — mesmo espírito acima, campo de busca por TAG/tipo. */
export function TabelaItensEquipamento({ itens }) {
  const [busca, setBusca] = useState('')

  const itensFiltrados = useMemo(() => {
    const alvo = busca.trim().toLowerCase()
    if (!alvo) return itens
    return itens.filter(
      (item) => (item.tag ?? '').toLowerCase().includes(alvo) || (item.tipo_equipamento ?? '').toLowerCase().includes(alvo),
    )
  }, [itens, busca])

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={busca}
        onChange={(event) => setBusca(event.target.value)}
        placeholder="Buscar por TAG ou tipo..."
        className={CLASSE_BUSCA}
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-700/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">TAG</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Tipo</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Classificação</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Peso Total (kg)</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">% Içamento</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">% Alinhamento</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">% Fixação</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">% Total</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Peso Executado (kg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
            {itensFiltrados.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center text-gray-400 dark:text-slate-500">
                  Nenhum equipamento encontrado.
                </td>
              </tr>
            ) : (
              itensFiltrados.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-navy dark:text-slate-100">{item.tag}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-slate-400">{item.tipo_equipamento ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-slate-400">{item.classificacao}</td>
                  <td className="px-3 py-2 text-right text-navy dark:text-slate-100">{formatarPeso(item.peso_total)}</td>
                  <td className="px-3 py-2 text-right text-navy dark:text-slate-100">
                    {formatarPercentualIndicador(item.percentual_icamento)}
                  </td>
                  <td className="px-3 py-2 text-right text-navy dark:text-slate-100">
                    {formatarPercentualIndicador(item.percentual_alinhamento)}
                  </td>
                  <td className="px-3 py-2 text-right text-navy dark:text-slate-100">
                    {formatarPercentualIndicador(item.percentual_fixacao)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-accent">
                    {formatarPercentualIndicador(item.percentual_total)}
                  </td>
                  <td className="px-3 py-2 text-right text-navy dark:text-slate-100">{formatarPeso(item.peso_executado)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
