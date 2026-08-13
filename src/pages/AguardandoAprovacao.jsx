import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import Card from '../components/Card'

export default function AguardandoAprovacao() {
  const { user, profile, loading, signOut } = useAuth()

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="text-gray-500 dark:text-slate-400">Carregando...</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Usuário já aprovado não deveria estar aqui.
  if (profile?.status_aprovacao === 'aprovado') {
    return <Navigate to="/" replace />
  }

  const recusado = profile?.status_aprovacao === 'recusado'

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card
        faixaCor={recusado ? '#d1495b' : '#a9791f'}
        className="w-full max-w-sm"
        contentClassName="p-6 text-center"
      >
        <h2 className="mb-2 text-lg font-semibold text-navy dark:text-slate-100">
          {recusado ? 'Cadastro recusado' : 'Cadastro em análise'}
        </h2>
        <p className="mb-6 text-sm text-gray-600 dark:text-slate-300">
          {recusado
            ? 'Seu cadastro foi recusado por um administrador. Entre em contato caso acredite que isso seja um engano.'
            : 'Seu cadastro está aguardando aprovação de um administrador. Assim que for aprovado, você poderá acessar o sistema.'}
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Sair
        </button>
      </Card>
    </main>
  )
}
