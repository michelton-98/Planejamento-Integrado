import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const ABA_BASE =
  'border-b-2 px-1 py-3 text-sm font-medium transition-colors -mb-px'
const ABA_ATIVA = 'border-accent text-accent'
const ABA_INATIVA =
  'border-transparent text-gray-500 hover:border-gray-300 hover:text-navy dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100'

// Sub-navegação interna da ferramenta "Controle de RDO": só aparece
// dentro dela (/rdo e /input), nunca no cabeçalho global — ver
// Header.jsx. "Importar RDOs" só é visível pra admin, mesma regra de
// acesso que a rota /input já aplica (AdminRoute).
export default function RdoToolNav() {
  const { profile } = useAuth()

  return (
    <nav className="border-b border-gray-200 bg-white px-4 sm:px-6 print:hidden dark:border-slate-700 dark:bg-slate-800">
      <div className="mx-auto flex max-w-6xl gap-6">
        <NavLink
          to="/rdo"
          end
          className={({ isActive }) => `${ABA_BASE} ${isActive ? ABA_ATIVA : ABA_INATIVA}`}
        >
          Dashboard
        </NavLink>
        {profile?.is_admin && (
          <NavLink
            to="/input"
            className={({ isActive }) => `${ABA_BASE} ${isActive ? ABA_ATIVA : ABA_INATIVA}`}
          >
            Importar RDOs
          </NavLink>
        )}
      </div>
    </nav>
  )
}
