import { useTheme } from '../lib/ThemeContext'

// Interruptor de modo noturno do cabeçalho — mesmo padrão visual/dimensões
// do ToggleModo (Controle de Validações): trilho + bolinha deslizante;
// aqui o ícone (sol/lua) fica dentro da própria bolinha, trocando conforme
// o tema ativo.
export default function ThemeToggle() {
  const { tema, alternarTema } = useTheme()
  const escuro = tema === 'dark'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={escuro}
      aria-label={escuro ? 'Ativar modo claro' : 'Ativar modo noturno'}
      onClick={alternarTema}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${escuro ? 'bg-navy dark:bg-accent' : 'bg-gray-300'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] leading-none shadow transition-transform ${
          escuro ? 'translate-x-5' : 'translate-x-0'
        }`}
      >
        {escuro ? '🌙' : '☀️'}
      </span>
    </button>
  )
}
