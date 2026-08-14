import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { temAcessoFerramenta } from '../lib/ferramentas'
import Spinner from './Spinner'

// `ferramenta`: chave opcional de FERRAMENTAS (ver src/lib/ferramentas.jsx)
// — quando informada, além do login/aprovação, também exige acesso à
// ferramenta (ver temAcessoFerramenta e "Personalizar Acesso" em
// AdminUsuarios.jsx). Bloqueia a rota direta por URL mesmo que o card
// correspondente já esteja escondido no Painel (Home.jsx).
export default function ProtectedRoute({ children, ferramenta }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 p-6 text-gray-500 dark:text-slate-400">
        <Spinner className="h-5 w-5" />
        Carregando...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (profile?.status_aprovacao !== 'aprovado') {
    return <Navigate to="/aguardando-aprovacao" replace />
  }

  if (ferramenta && !temAcessoFerramenta(profile, ferramenta)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-navy dark:text-slate-100">Acesso restrito</p>
        <p className="max-w-md text-sm text-gray-500 dark:text-slate-400">
          Você não tem acesso a esta ferramenta. Fale com um administrador se acha que isso é um engano.
        </p>
        <Link to="/" className="mt-2 text-sm font-medium text-accent hover:underline">
          Voltar ao Painel de Ferramentas
        </Link>
      </div>
    )
  }

  return children
}
