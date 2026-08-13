// Gauge de meia-rosca (velocímetro) desenhado em SVG puro: um arco de
// fundo (trilha) de 180° a 0° (esquerda → topo → direita) e um ou mais
// arcos coloridos sobrepostos representando percentuais (0-100,
// cumulativos, na ordem de `segments`). Evita as limitações do
// RadialBarChart do recharts para desenhar mais de um segmento colorido
// no mesmo arco (ex.: item 5 — "Especialista x Contratada").
function pontoNoArco(cx, cy, r, percent) {
  const angulo = 180 - (percent / 100) * 180
  const rad = (angulo * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) }
}

function trechoArco(cx, cy, r, percentInicio, percentFim) {
  const inicio = pontoNoArco(cx, cy, r, percentInicio)
  const fim = pontoNoArco(cx, cy, r, percentFim)
  return `M ${inicio.x} ${inicio.y} A ${r} ${r} 0 0 1 ${fim.x} ${fim.y}`
}

/**
 * `segments`: [{ value: 0-100, color }] — valores cumulativos ao longo do
 * arco (ex.: [{ value: 30, color: accent }] pinta só os primeiros 30% do
 * arco; o resto fica com `corFundo`).
 */
export default function GaugeChart({
  segments,
  corFundo = '#e5e7eb',
  valorLabel,
  descricao,
  tamanho = 200,
  espessura = 18,
}) {
  const cx = tamanho / 2
  const cy = tamanho / 2
  const r = tamanho / 2 - espessura / 2 - 4
  const altura = tamanho / 2 + espessura / 2 + 12

  let acumulado = 0
  const trechos = segments
    .filter((segmento) => segmento.value > 0)
    .map((segmento) => {
      const inicio = acumulado
      const fim = Math.min(acumulado + segmento.value, 100)
      acumulado = fim
      return { color: segmento.color, d: trechoArco(cx, cy, r, inicio, fim) }
    })

  return (
    <div className="flex flex-col items-center">
      <svg width="100%" viewBox={`0 0 ${tamanho} ${altura}`} style={{ maxWidth: tamanho }}>
        <path
          d={trechoArco(cx, cy, r, 0, 100)}
          fill="none"
          stroke={corFundo}
          strokeWidth={espessura}
          strokeLinecap="round"
        />
        {trechos.map((trecho, indice) => (
          <path
            key={indice}
            d={trecho.d}
            fill="none"
            stroke={trecho.color}
            strokeWidth={espessura}
            strokeLinecap="round"
          />
        ))}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-navy dark:fill-slate-100"
          style={{ fontSize: 26, fontWeight: 700 }}
        >
          {valorLabel}
        </text>
      </svg>
      {descricao && <div className="mt-1 text-center text-xs text-gray-500 dark:text-slate-400">{descricao}</div>}
    </div>
  )
}
