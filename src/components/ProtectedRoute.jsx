import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { podeImportarRdos, temAcessoFerramenta } from '../lib/ferramentas'
import Spinner from './Spinner'

function AcessoRestrito({ mensagem }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-lg font-semibold text-navy dark:text-slate-100">Acesso restrito</p>
      <p className="max-w-md text-sm text-gray-500 dark:text-slate-400">{mensagem}</p>
      <Link to="/" className="mt-2 text-sm font-medium text-accent hover:underline">
        Voltar ao Painel de Ferramentas
      </Link>
    </div>
  )
}

// `ferramenta`: chave opcional de FERRAMENTAS (ver src/lib/ferramentas.jsx)
// — quando informada, além do login/aprovação, também exige acesso à
// ferramenta (ver temAcessoFerramenta e "Personalizar Acesso" em
// AdminUsuarios.jsx). `requerImportarRdos`: exige também acesso à aba
// Importar RDOs (ver podeImportarRdos) — usado só na rota /input. Ambos
// bloqueiam a rota direta por URL mesmo que o link correspondente já
// esteja escondido na interface.
export default function ProtectedRoute({ children, ferramenta, requerImportarRdos = false }) {
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
      <AcessoRestrito mensagem="Você não tem acesso a esta ferramenta. Fale com um administrador se acha que isso é um engano." />
    )
  }

  if (requerImportarRdos && !podeImportarRdos(profile)) {
    return (
      <AcessoRestrito mensagem="Você não tem acesso à aba Importar RDOs. Fale com um administrador se acha que isso é um engano." />
    )
  }

  return children
}
