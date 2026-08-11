import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function Header() {
  const { user, profile, signOut } = useAuth()

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4 print:hidden">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <Link to="/" className="text-lg font-semibold text-navy hover:text-navy/80 sm:text-xl">
          Planejamento Integrado
        </Link>
        {profile?.status_aprovacao === 'aprovado' && (
          <Link to="/rdo" className="text-sm font-medium text-accent hover:underline">
            Controle de RDO
          </Link>
        )}
        {/* Importar RDOs e Gestão de Usuários são restritos a administradores. */}
        {profile?.is_admin && (
          <>
            <Link to="/input" className="text-sm font-medium text-accent hover:underline">
              Importar RDOs
            </Link>
            <Link to="/admin/usuarios" className="text-sm font-medium text-accent hover:underline">
              Gestão de Usuários
            </Link>
          </>
        )}
      </div>

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
