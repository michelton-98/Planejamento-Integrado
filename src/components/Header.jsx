import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import ThemeToggle from './ThemeToggle'

// Chrome global, presente em toda tela interna: só a marca (link pro
// Painel de Ferramentas) e a sessão do usuário. Os links de cada
// ferramenta (Controle de RDO, Importar RDOs, Gestão de Usuários) NÃO
// ficam mais aqui — cada um só aparece depois que o usuário entra na
// ferramenta correspondente (ver RdoToolNav.jsx para a navegação interna
// do Controle de RDO; Gestão de Usuários e Controle de Validações são
// acessados pelos cards do Painel).
export default function Header() {
  const { user, signOut } = useAuth()
  const location = useLocation()

  // Na própria página inicial ("/"), e-mail + Sair já aparecem dentro da
  // moldura do Painel de Ferramentas (junto com avatar/nome/papel) — não
  // repete aqui pra não duplicar. Nas demais telas (sem essa moldura),
  // continua sendo o único lugar com o botão Sair.
  const naPaginaInicial = location.pathname === '/'

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4 print:hidden dark:border-slate-700 dark:bg-slate-800">
      <Link to="/" className="text-lg font-semibold text-navy hover:text-navy/80 sm:text-xl dark:text-slate-100 dark:hover:text-slate-300">
        Planejamento Integrado
      </Link>

      <div className="flex items-center gap-3 sm:gap-4">
        <ThemeToggle />

        {user && !naPaginaInicial && (
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden max-w-[10rem] truncate text-sm text-gray-600 sm:inline md:max-w-xs dark:text-slate-400">
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
