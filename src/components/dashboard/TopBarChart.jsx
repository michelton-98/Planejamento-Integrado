import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTheme } from '../../lib/ThemeContext'
import Card from '../Card'

const COR_SELECIONADO = '#a9791f' // gold — mesmo acento de "seleção" usado no explorador

function TooltipPersonalizado({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0]

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-600 dark:bg-slate-700">
      <p className="font-medium text-navy dark:text-slate-100">{item.payload.nome}</p>
      <p className="text-gray-600 dark:text-slate-300">
        <span className="font-semibold text-navy dark:text-slate-100">{item.value}</span> pendência(s)
      </p>
    </div>
  )
}

// Série única (uma cor, sem legenda — o título já diz o que é) por
// definição do skill dataviz: "a single series needs no legend box".
// Barras são clicáveis (onBarClick) e a barra cujo nome bate com
// `nomeSelecionado` fica em destaque (contorno dourado, demais com opacidade
// reduzida) — sincroniza com o explorador de pendências abaixo.
//
// Recharts pinta eixo/grade/rótulos via `style`/props (SVG puro), não dá
// pra usar `dark:` do Tailwind neles — por isso essas cores (só essas,
// texto e não os dados) trocam via JS conforme `useTheme()`.
export default function TopBarChart({ titulo, data, cor = '#2f6fed', nomeSelecionado, onBarClick }) {
  const { tema } = useTheme()
  const escuro = tema === 'dark'
  const altura = Math.max(data.length * 44, 120)

  return (
    <Card faixaCor="#2f6fed" categoria="Ranking" titulo={titulo}>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Sem dados.</p>
      ) : (
        <ResponsiveContainer width="100%" height={altura}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }}>
            <CartesianGrid horizontal={false} stroke={escuro ? '#334155' : '#e5e7eb'} />
            <XAxis type="number" allowDecimals={false} hide />
            <YAxis
              type="category"
              dataKey="nome"
              width={150}
              tick={{ fill: escuro ? '#cbd5e1' : '#374151', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<TooltipPersonalizado />}
              cursor={{ fill: escuro ? '#334155' : '#f9fafb' }}
            />
            <Bar
              dataKey="total"
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
              isAnimationActive={false}
              onClick={(entry) => onBarClick?.(entry.nome)}
              style={{ cursor: onBarClick ? 'pointer' : undefined }}
            >
              {data.map((entry) => {
                const selecionada = entry.nome === nomeSelecionado
                return (
                  <Cell
                    key={entry.nome}
                    fill={cor}
                    fillOpacity={nomeSelecionado && !selecionada ? 0.35 : 1}
                    stroke={selecionada ? COR_SELECIONADO : 'none'}
                    strokeWidth={selecionada ? 2 : 0}
                  />
                )
              })}
              <LabelList
                dataKey="total"
                position="right"
                style={{ fill: escuro ? '#f1f5f9' : '#12263f', fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
