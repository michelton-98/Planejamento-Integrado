import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

// Chrome global, presente em toda tela interna: só a marca (link pro
// Painel de Ferramentas) e a sessão do usuário. Os links de cada
// ferramenta (Controle de RDO, Importar RDOs, Gestão de Usuários) NÃO
// ficam mais aqui — cada um só aparece depois que o usuário entra na
// ferramenta correspondente (ver RdoToolNav.jsx para a navegação interna
// do Controle de RDO; Gestão de Usuários e Controle de Validações são
// acessados pelos cards do Painel).
export default function Header() {
  const { user, signOut } = useAuth()

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4 print:hidden">
      <Link to="/" className="text-lg font-semibold text-navy hover:text-navy/80 sm:text-xl">
        Planejamento Integrado
      </Link>

      {user && (
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden max-w-[10rem] truncate text-sm text-gray-600 sm:inline md:max-w-xs">
            {user.email}
          </span>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Sair
          </button>
        </div>
      )}
    </header>
  )
}
