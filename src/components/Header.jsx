import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function Header() {
  const { user, profile, signOut } = useAuth()

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <h1 className="text-lg font-semibold text-navy sm:text-xl">Controle RDO</h1>
        {profile?.status_aprovacao === 'aprovado' && (
          <Link to="/" className="text-sm font-medium text-accent hover:underline">
            Dashboard
          </Link>
        )}
        {/* Importar RDOs é restrito a administradores. */}
        {profile?.is_admin && (
          <>
            <Link to="/input" className="text-sm font-medium text-accent hover:underline">
              Importar RDOs
            </Link>
            <Link to="/admin/aprovacoes" className="text-sm font-medium text-accent hover:underline">
              Aprovações
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
