import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import {
  STATUS_ISOMETRICO,
  avancoBombasMontagem,
  avancoSI,
  avancoTorresMontagem,
  avancoTrocadorCalorBarras,
  indicadoresEstrutura,
  itensTorres,
  statusIsometricos,
} from '../../lib/gestaoVisual'
import { useTheme } from '../../lib/ThemeContext'
import Card from '../Card'

// Painel "Gestão Visual" (Dashboard de Destilaria Fase I) — cards visuais
// (gráficos, não tabelas) complementando os indicadores por
// disciplina/empresa já existentes acima. Ver src/lib/gestaoVisual.js pros
// cálculos (arquivo mais recente de cada empresa/escopo + classificações).
//
// Ramp ordinal de 1 hue (azul), validado com scripts/validate_palette.js do
// skill dataviz (`--ordinal`, claro→escuro, sem repetir passo entre modo
// claro/escuro): representa os 4 status dos isométricos como estágios de
// um progresso (não categorias soltas), com o passo mais claro predominando
// no chart quando a maioria ainda não começou — "azul claro predominante".
const CORES_STATUS_CLARO = ['#86b6ef', '#3987e5', '#1c5cab', '#0d366b']
const CORES_STATUS_ESCURO = ['#6da7ec', '#3987e5', '#256abf', '#184f95']

const FAIXA_COR = '#7c3aed' // mesma faixa roxa usada em todo card do Avanço Integrado (ver AvancoDashboard.jsx)

function formatarPercentual(valor) {
  if (valor === null || valor === undefined) return '—'
  return `${Number(valor).toFixed(1)}%`
}

/** Linha "rotulo + % + barra preenchida" — dado real (accent). */
function BarraPercentual({ rotulo, percentual }) {
  const largura = percentual === null || percentual === undefined ? 0 : Math.min(100, Math.max(0, percentual))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="text-gray-600 dark:text-slate-300">{rotulo}</span>
        <span className="font-semibold text-navy dark:text-slate-100">{formatarPercentual(percentual)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
        <div className="h-full rounded-full bg-accent" style={{ width: `${largura}%` }} />
      </div>
    </div>
  )
}

/** Linha placeholder pra escopo que ainda não existe (outra empresa/fase futura) — cinza + opacidade reduzida, SEM número (nunca "0%", pra não passar a ideia de avanço real medido). */
function BarraEmBreve({ rotulo }) {
  return (
    <div className="opacity-50">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="text-gray-600 dark:text-slate-300">{rotulo}</span>
        <span className="font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Em breve</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-600" />
    </div>
  )
}

/** Card "Estrutura": 6 barras horizontais, uma por indicador da FORTYS. */
function CardEstrutura({ indicadores }) {
  return (
    <Card faixaCor={FAIXA_COR} categoria="FORTYS · Metal" titulo="Estrutura">
      <div className="flex flex-col gap-3">
        {indicadores.map((item) => (
          <BarraPercentual key={item.nome} rotulo={item.nome} percentual={item.percentual} />
        ))}
      </div>
    </Card>
  )
}

/** Donut de status (4 fatias) + contagem total no centro + legenda com cor/contagem — um por material (Carbono/Inox). */
function DonutIsometricos({ titulo, resultado }) {
  const { tema } = useTheme()
  const cores = tema === 'dark' ? CORES_STATUS_ESCURO : CORES_STATUS_CLARO

  const dados = STATUS_ISOMETRICO.map((status, indice) => ({
    ...status,
    valor: resultado.contagem[status.chave],
    cor: cores[indice],
  }))

  return (
    <Card faixaCor={FAIXA_COR} categoria="QUALISOLDA · Metal" titulo={titulo}>
      {resultado.total === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum arquivo enviado ainda.</p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dados}
                  dataKey="valor"
                  nameKey="rotulo"
                  innerRadius="62%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {dados.map((item) => (
                    <Cell key={item.chave} fill={item.cor} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold text-navy dark:text-slate-100">{resultado.total}</span>
              <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-slate-500">isométricos</span>
            </div>
          </div>

          <ul className="flex w-full flex-1 flex-col gap-1.5">
            {dados.map((item) => (
              <li key={item.chave} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-2 text-gray-600 dark:text-slate-300">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.cor }} />
                  {item.rotulo}
                </span>
                <span className="font-semibold text-navy dark:text-slate-100">{item.valor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

/**
 * Aba "Dashboard" de Destilaria Fase I: painel "Gestão Visual" (cards
 * visuais complementando os indicadores por disciplina/empresa acima) — ver
 * src/lib/gestaoVisual.js pros cálculos. Cards "Em breve" (Bases Civis,
 * Graute Nicho e Skid, Escadas e Plataformas, Alinhamento, Bandejamento
 * Interno) são placeholders de escopos que ainda não existem — outra
 * empresa/disciplina entra nos próximos prompts.
 */
export default function GestaoVisual({ arquivos, indicadoresPorArquivo, itensTubulacaoPorArquivo, itensEquipamentoPorArquivo }) {
  const estrutura = useMemo(() => indicadoresEstrutura(arquivos, indicadoresPorArquivo), [arquivos, indicadoresPorArquivo])
  const statusCarbono = useMemo(
    () => statusIsometricos(arquivos, itensTubulacaoPorArquivo, 'carbono'),
    [arquivos, itensTubulacaoPorArquivo],
  )
  const statusInox = useMemo(() => statusIsometricos(arquivos, itensTubulacaoPorArquivo, 'inox'), [arquivos, itensTubulacaoPorArquivo])
  const si = useMemo(() => avancoSI(arquivos, itensEquipamentoPorArquivo), [arquivos, itensEquipamentoPorArquivo])
  const trocador = useMemo(() => avancoTrocadorCalorBarras(arquivos, itensEquipamentoPorArquivo), [arquivos, itensEquipamentoPorArquivo])
  const torresMontagem = useMemo(() => avancoTorresMontagem(arquivos, itensEquipamentoPorArquivo), [arquivos, itensEquipamentoPorArquivo])
  const listaTorres = useMemo(() => itensTorres(arquivos, itensEquipamentoPorArquivo), [arquivos, itensEquipamentoPorArquivo])
  const bombasMontagem = useMemo(() => avancoBombasMontagem(arquivos, itensEquipamentoPorArquivo), [arquivos, itensEquipamentoPorArquivo])

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-navy dark:text-slate-100">Gestão Visual</h2>

      <CardEstrutura indicadores={estrutura} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DonutIsometricos titulo="Isométricos Carbono" resultado={statusCarbono} />
        <DonutIsometricos titulo="Isométricos Inox" resultado={statusInox} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card faixaCor={FAIXA_COR} categoria="QUALISOLDA · Metal" titulo="SI's">
          <BarraPercentual rotulo="Avanço geral" percentual={si.percentual} />
        </Card>
        <Card faixaCor={FAIXA_COR} categoria="QUALISOLDA · Metal" titulo="Trocador de Calor de Barras">
          <BarraPercentual rotulo="Avanço geral" percentual={trocador.percentual} />
        </Card>
      </div>

      <Card faixaCor={FAIXA_COR} categoria="QUALISOLDA · Metal" titulo="Torres">
        <div className="flex flex-col gap-3">
          <BarraEmBreve rotulo="Bases Civis" />
          <BarraPercentual rotulo="Montagem" percentual={torresMontagem.percentual} />
          <BarraEmBreve rotulo="Escadas e Plataformas" />
        </div>
      </Card>

      <Card faixaCor={FAIXA_COR} categoria="QUALISOLDA · Metal" titulo="Bandejamento Interno">
        {listaTorres.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">Nenhuma torre cadastrada ainda.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {listaTorres.map((item) => (
              <BarraEmBreve key={item.id} rotulo={item.tag} />
            ))}
          </div>
        )}
      </Card>

      <Card faixaCor={FAIXA_COR} categoria="QUALISOLDA · Metal" titulo="Bombas">
        <div className="flex flex-col gap-3">
          <BarraEmBreve rotulo="Bases Civis" />
          <BarraEmBreve rotulo="Graute Nicho e Skid" />
          <BarraPercentual rotulo="Montagem" percentual={bombasMontagem.percentual} />
          <BarraEmBreve rotulo="Alinhamento" />
        </div>
      </Card>
    </div>
  )
}
