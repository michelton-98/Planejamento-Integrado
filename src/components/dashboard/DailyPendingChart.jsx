import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Card from '../Card'

// Cor = status de prazo (vermelho reservado para "atrasada", o alerta de
// verdade); opacidade = estágio (contratada em cor cheia, especialista em
// tom mais claro da mesma cor) — segue a regra de "status color" do skill
// de dataviz: uma cor de status nunca deve fazer dupla função de
// identidade categórica, então quem carrega contratada × especialista é a
// opacidade (secundária) + a posição das duas colunas agrupadas por dia.
const COR_NO_PRAZO = '#2f6fed'
const COR_ATRASADA = '#d1495b'
const OPACIDADE_CONTRATADA = 1
const OPACIDADE_ESPECIALISTA = 0.55

const SERIES = [
  { key: 'contratada_no_prazo', label: 'Contratada — no prazo', fill: COR_NO_PRAZO, fillOpacity: OPACIDADE_CONTRATADA },
  { key: 'contratada_atrasada', label: 'Contratada — atrasada', fill: COR_ATRASADA, fillOpacity: OPACIDADE_CONTRATADA },
  { key: 'especialista_no_prazo', label: 'Especialista — no prazo', fill: COR_NO_PRAZO, fillOpacity: OPACIDADE_ESPECIALISTA },
  { key: 'especialista_atrasada', label: 'Especialista — atrasada', fill: COR_ATRASADA, fillOpacity: OPACIDADE_ESPECIALISTA },
]

const LABEL_POR_KEY = Object.fromEntries(SERIES.map((s) => [s.key, s.label]))

function TooltipPersonalizado({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="mb-1 font-medium text-navy">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color, opacity: item.payload && item.fillOpacity }}
          />
          <span className="text-gray-600">{LABEL_POR_KEY[item.dataKey]}:</span>
          <span className="font-semibold text-navy">{item.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function DailyPendingChart({ data }) {
  return (
    <Card faixaCor="#12263f" categoria="Gráfico" titulo="Evolução diária — últimos 15 dias">
      {/* Em telas estreitas, os 15 rótulos do eixo X não cabem sem colidir
          — em vez de espremê-los, mantém a largura mínima do gráfico e
          deixa o cartão rolar horizontalmente. */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} barCategoryGap="24%" barGap={2}>
              <CartesianGrid vertical={false} stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip content={<TooltipPersonalizado />} cursor={{ fill: '#f9fafb' }} />
              <Legend
                formatter={(value) => (
                  <span className="text-sm text-gray-600">{LABEL_POR_KEY[value]}</span>
                )}
                wrapperStyle={{ paddingTop: 8 }}
              />
              <Bar
                dataKey="contratada_no_prazo"
                stackId="contratada"
                fill={COR_NO_PRAZO}
                fillOpacity={OPACIDADE_CONTRATADA}
                maxBarSize={20}
                isAnimationActive={false}
              />
              <Bar
                dataKey="contratada_atrasada"
                stackId="contratada"
                fill={COR_ATRASADA}
                fillOpacity={OPACIDADE_CONTRATADA}
                radius={[4, 4, 0, 0]}
                maxBarSize={20}
                isAnimationActive={false}
              />
              <Bar
                dataKey="especialista_no_prazo"
                stackId="especialista"
                fill={COR_NO_PRAZO}
                fillOpacity={OPACIDADE_ESPECIALISTA}
                maxBarSize={20}
                isAnimationActive={false}
              />
              <Bar
                dataKey="especialista_atrasada"
                stackId="especialista"
                fill={COR_ATRASADA}
                fillOpacity={OPACIDADE_ESPECIALISTA}
                radius={[4, 4, 0, 0]}
                maxBarSize={20}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  )
}
