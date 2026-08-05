import GaugeChart from './GaugeChart'

const COR_ATRASO = '#d1495b'
const COR_ESPECIALISTA = '#2f6fed'
const COR_CONTRATADA = '#12263f'

function Legenda({ cor, rotulo }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cor }} />
      {rotulo}
    </span>
  )
}

/**
 * Dois gauges lado a lado (item 5): Taxa de Atraso (atrasadas / total a
 * aprovar) e Especialista x Contratada (participação de cada estágio no
 * total de pendências). `stats` deve vir de computeStats já calculado
 * sobre o universo de obras "em andamento" (rowsAtivas), como todo o
 * resto do dashboard.
 */
export default function GaugesRow({ stats }) {
  const pctAtraso = stats.total ? (stats.atrasadas / stats.total) * 100 : 0

  const denomEstagio = stats.pendenteEspecialista + stats.pendenteContratada
  const pctEspecialista = denomEstagio ? (stats.pendenteEspecialista / denomEstagio) * 100 : 0
  const pctContratada = 100 - pctEspecialista

  return (
    <div className="flex flex-1 flex-wrap items-start justify-around gap-6">
      <div className="flex flex-col items-center">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Taxa de Atraso
        </p>
        <GaugeChart
          segments={[{ value: pctAtraso, color: COR_ATRASO }]}
          valorLabel={`${Math.round(pctAtraso)}%`}
          descricao={`${stats.atrasadas} de ${stats.total} aprovação(ões)`}
          tamanho={180}
        />
      </div>

      <div className="flex flex-col items-center">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Especialista x Contratada
        </p>
        {denomEstagio === 0 ? (
          <div className="flex h-[104px] items-center text-sm text-gray-400">Sem dados</div>
        ) : (
          <GaugeChart
            segments={[
              { value: pctEspecialista, color: COR_ESPECIALISTA },
              { value: pctContratada, color: COR_CONTRATADA },
            ]}
            valorLabel={`${Math.round(pctEspecialista)}%`}
            descricao={
              <div className="flex flex-col items-center gap-0.5">
                <Legenda cor={COR_ESPECIALISTA} rotulo={`Especialista ${Math.round(pctEspecialista)}%`} />
                <Legenda cor={COR_CONTRATADA} rotulo={`Contratada ${Math.round(pctContratada)}%`} />
              </div>
            }
            tamanho={180}
          />
        )}
      </div>
    </div>
  )
}
