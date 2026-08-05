import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import AuthLayout from '../components/auth/AuthLayout'
import Spinner from '../components/Spinner'

export default function Login() {
  const { user, signInWithPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const from = location.state?.from?.pathname ?? '/'

  // Já autenticado: não faz sentido mostrar a tela de login.
  if (user) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error } = await signInWithPassword(email, password)

    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    navigate(from, { replace: true })
  }

  return (
    <AuthLayout>
      <h2 className="text-lg font-semibold text-navy">Entrar</h2>
      <p className="mt-1 mb-6 text-sm text-gray-500">
        Use o e-mail e senha cadastrados para acessar o sistema.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none"
        />

        <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
          Senha
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none"
        />

        <div className="mb-4 text-right">
          <Link to="/esqueci-senha" className="text-sm font-medium text-accent hover:underline">
            Esqueci minha senha
          </Link>
        </div>

        {error && <p className="mb-4 text-sm text-alert">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-navy px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
        >
          {submitting && <Spinner className="h-4 w-4" />}
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="my-6 border-t border-gray-200" />

      <p className="text-center text-sm text-gray-600">
        Não tem cadastro?{' '}
        <Link to="/cadastro" className="font-medium text-accent hover:underline">
          Solicitar acesso
        </Link>
      </p>
    </AuthLayout>
  )
}
