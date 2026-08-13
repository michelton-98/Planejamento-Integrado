// Toggle "estilo liga-desliga" com os dois rótulos flanqueando a chave —
// Semanal à esquerda, Mensal à direita. Componente compartilhado entre a
// aba Dashboard e o painel "Emitir Relatório" (ambos alternam entre os
// mesmos dois modos) — mesmo visual nos dois lugares, sem duplicar.
export default function ToggleModo({ modo, onChange }) {
  const semanal = modo === 'semanal'
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <span className={semanal ? 'text-navy' : 'text-gray-400'}>Semanal</span>
      <button
        type="button"
        role="switch"
        aria-checked={!semanal}
        onClick={() => onChange(semanal ? 'mensal' : 'semanal')}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          semanal ? 'bg-gray-300' : 'bg-accent'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            semanal ? 'translate-x-0' : 'translate-x-5'
          }`}
        />
      </button>
      <span className={!semanal ? 'text-navy' : 'text-gray-400'}>Mensal</span>
    </div>
  )
}
