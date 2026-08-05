import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import AuthLayout from '../components/auth/AuthLayout'
import Spinner from '../components/Spinner'

export default function EsqueciSenha() {
  const { resetPasswordForEmail } = useAuth()

  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setEnviando(true)

    const { error } = await resetPasswordForEmail(email)

    setEnviando(false)

    if (error) {
      setError(error.message)
      return
    }

    // Mensagem genérica sempre — não confirma nem nega se o e-mail existe
    // na base, para não vazar quais e-mails têm cadastro.
    setEnviado(true)
  }

  if (enviado) {
    return (
      <AuthLayout>
        <h2 className="text-lg font-semibold text-navy">Verifique seu e-mail</h2>
        <p className="mt-2 text-sm text-gray-600">
          Se esse e-mail estiver cadastrado, você receberá um link de recuperação.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
        >
          Voltar para o login
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h2 className="text-lg font-semibold text-navy">Esqueci minha senha</h2>
      <p className="mt-1 mb-6 text-sm text-gray-500">
        Informe o e-mail cadastrado para receber um link de recuperação de senha.
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

        {error && <p className="mb-4 text-sm text-alert">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-navy px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
        >
          {enviando && <Spinner className="h-4 w-4" />}
          {enviando ? 'Enviando...' : 'Enviar link de recuperação'}
        </button>
      </form>

      <div className="my-6 border-t border-gray-200" />

      <p className="text-center text-sm text-gray-600">
        Lembrou a senha?{' '}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Voltar para o login
        </Link>
      </p>
    </AuthLayout>
  )
}
