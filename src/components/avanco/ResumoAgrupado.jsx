import { useMemo } from 'react'
import { OPCOES_AGRUPAR, formatarPeso, montarResumoAgrupado } from '../../lib/qualisoldaAgrupamento'
import Card from '../Card'
import { formatarPercentualIndicador } from './TabelaIndicadoresFortys'

// Seletor "Agrupar" + os 2 cards de resumo (estático e comparado) —
// compartilhados entre AvancoDataBase.jsx (snapshot de 1 Empresa+Data) e
// AvancoAtualizacao.jsx (comparação entre a data atual e a anterior). Ver
// src/lib/qualisoldaAgrupamento.js pras 4 opções e a soma em si.

const CLASSE_SELECT =
  'rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]'

/** Seletor "Agrupar": "Nenhum" (comportamento de sempre, item a item) + as 4 opções de grupo. */
export function SeletorAgrupar({ value, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
      Agrupar
      <select value={value} onChange={(event) => onChange(event.target.value)} className={CLASSE_SELECT}>
        <option value="">Nenhum (ver itens)</option>
        {OPCOES_AGRUPAR.map((opcao) => (
          <option key={opcao.chave} value={opcao.chave}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </label>
  )
}

function TileResumoPesos({ rotulo, pesoTotal, pesoExecutado, percentual }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-slate-700">
      <p className="mb-2 text-xs font-medium text-gray-500 dark:text-slate-400">{rotulo}</p>
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg bg-gray-50 p-3 text-center dark:bg-slate-700/40">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">Peso Previsto (kg)</p>
          <p className="text-lg font-semibold text-navy dark:text-slate-100">{formatarPeso(pesoTotal)}</p>
        </div>
        <div className="flex-1 rounded-lg bg-gray-50 p-3 text-center dark:bg-slate-700/40">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">Peso Executado (kg)</p>
          <p className="text-lg font-semibold text-navy dark:text-slate-100">{formatarPeso(pesoExecutado)}</p>
        </div>
        <div className="flex-1 rounded-lg bg-gray-50 p-3 text-center dark:bg-slate-700/40">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">% Avanço</p>
          <p className="text-lg font-semibold text-accent">{formatarPercentualIndicador(percentual)}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Resumo estático (Data_Base): peso previsto/executado/% avanço do grupo
 * escolhido, pra 1 snapshot de Empresa+Data — sem comparação.
 * `itensCarbono`/`itensInox`/`itensEquipamento` já vêm filtrados pro
 * arquivo/data em questão (ver AvancoDataBase.jsx).
 */
export function ResumoAgrupadoEstatico({ opcao, itensCarbono, itensInox, itensEquipamento }) {
  const rotulo = OPCOES_AGRUPAR.find((item) => item.chave === opcao)?.rotulo ?? ''
  const resumo = useMemo(
    () => montarResumoAgrupado(opcao, { itensCarbono, itensInox, itensEquipamento }),
    [opcao, itensCarbono, itensInox, itensEquipamento],
  )

  return (
    <Card faixaCor="#7c3aed" categoria="Resumo agrupado" titulo={rotulo}>
      <div className="flex flex-col gap-3">
        <TileResumoPesos rotulo="Total" {...resumo.total} />
        {resumo.subtotais?.map((sub) => <TileResumoPesos key={sub.rotulo} rotulo={sub.rotulo} {...sub} />)}
      </div>
    </Card>
  )
}

function LinhaComparacao({ rotulo, anterior, atual, ehPercentual = false }) {
  const delta = atual - anterior
  const valorAnterior = ehPercentual ? formatarPercentualIndicador(anterior) : `${formatarPeso(anterior)} kg`
  const valorAtual = ehPercentual ? formatarPercentualIndicador(atual) : `${formatarPeso(atual)} kg`
  const sinal = delta >= 0 ? '+' : ''
  const valorDelta = ehPercentual ? `${sinal}${delta.toFixed(1)} pp` : `${sinal}${formatarPeso(delta)} kg`
  const corDelta = delta > 0 ? 'text-success' : delta < 0 ? 'text-alert' : 'text-gray-400 dark:text-slate-500'

  return (
    <tr>
      <td className="px-3 py-2 text-navy dark:text-slate-100">{rotulo}</td>
      <td className="px-3 py-2 text-right text-gray-500 dark:text-slate-400">{valorAnterior}</td>
      <td className="px-3 py-2 text-right text-navy dark:text-slate-100">{valorAtual}</td>
      <td className={`px-3 py-2 text-right font-medium ${corDelta}`}>{valorDelta}</td>
    </tr>
  )
}

function TabelaComparacaoResumo({ rotulo, anterior, atual }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{rotulo}</p>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-700/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Métrica</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Anterior</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Atual</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
            <LinhaComparacao rotulo="Peso Previsto (kg)" anterior={anterior.pesoTotal} atual={atual.pesoTotal} />
            <LinhaComparacao rotulo="Peso Executado (kg)" anterior={anterior.pesoExecutado} atual={atual.pesoExecutado} />
            <LinhaComparacao rotulo="% Avanço" anterior={anterior.percentual ?? 0} atual={atual.percentual ?? 0} ehPercentual />
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Resumo comparado (Atualização): peso previsto/executado/% avanço do
 * grupo escolhido nas 2 datas (anterior x atual), com Δ.
 * `itensAnterior`/`itensAtual`: `{ itensCarbono, itensInox,
 * itensEquipamento }` de cada uma das 2 datas (ver AvancoAtualizacao.jsx).
 */
export function ResumoAgrupadoComparacao({ opcao, itensAnterior, itensAtual }) {
  const rotulo = OPCOES_AGRUPAR.find((item) => item.chave === opcao)?.rotulo ?? ''
  const resumoAnterior = useMemo(() => montarResumoAgrupado(opcao, itensAnterior), [opcao, itensAnterior])
  const resumoAtual = useMemo(() => montarResumoAgrupado(opcao, itensAtual), [opcao, itensAtual])

  return (
    <Card faixaCor="#7c3aed" categoria="Resumo agrupado" titulo={rotulo}>
      <div className="flex flex-col gap-4">
        <TabelaComparacaoResumo rotulo="Total" anterior={resumoAnterior.total} atual={resumoAtual.total} />
        {resumoAnterior.subtotais?.map((sub, indice) => (
          <TabelaComparacaoResumo key={sub.rotulo} rotulo={sub.rotulo} anterior={sub} atual={resumoAtual.subtotais[indice]} />
        ))}
      </div>
    </Card>
  )
}
