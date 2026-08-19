import Card from '../Card'

// tone define tanto a cor do número quanto a faixa superior do card:
// neutral (navy) = informativo · accent (azul médio) = informativo/estágio
// alert (vermelho) = problema/atenção · success (verde) = positivo/favorável
const CORES_TOM = {
  neutral: '#12263f',
  accent: '#2f6fed',
  alert: '#d1495b',
  success: '#178a54',
  gold: '#a9791f',
}

const TEXTO_TOM = {
  neutral: 'text-navy dark:text-slate-100',
  accent: 'text-accent',
  alert: 'text-alert',
  success: 'text-success',
  gold: 'text-gold',
}

export default function StatCard({ label, value, tone = 'neutral' }) {
  return (
    <Card faixaCor={CORES_TOM[tone] ?? CORES_TOM.neutral}>
      <p className="text-sm text-gray-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${TEXTO_TOM[tone] ?? TEXTO_TOM.neutral}`}>
        {value}
      </p>
    </Card>
  )
}
