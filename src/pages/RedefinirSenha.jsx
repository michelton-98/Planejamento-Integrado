import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import AuthLayout from '../components/auth/AuthLayout'
import Spinner from '../components/Spinner'

export default function RedefinirSenha() {
  const { user, loading, updateUser } = useAuth()

  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erroLink, setErroLink] = useState(null)

  useEffect(() => {
    // Link de recuperação inválido/expirado: o Supabase volta com
    // "#error=...&error_description=..." na URL em vez de estabelecer uma
    // sessão de recuperação.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const description = hash.get('error_description')
    if (description) {
      setErroLink(description.replace(/\+/g, ' '))
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    if (senha.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (senha !== confirmarSenha) {
      setError('As senhas não coincidem.')
      return
    }

    setSubmitting(true)
    const { error } = await updateUser({ password: senha })
    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    setSucesso(true)
  }

  if (sucesso) {
    return (
      <AuthLayout>
        <h2 className="text-lg font-semibold text-navy">Senha atualizada</h2>
        <p className="mt-2 text-sm text-gray-600">
          Sua senha foi redefinida com sucesso. Você já pode entrar com a nova senha.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
        >
          Ir para o login
        </Link>
      </AuthLayout>
    )
  }

  if (erroLink) {
    return (
      <AuthLayout>
        <h2 className="text-lg font-semibold text-navy">Link inválido</h2>
        <p className="mt-2 text-sm text-alert">{erroLink}</p>
        <Link
          to="/esqueci-senha"
          className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
        >
          Solicitar um novo link
        </Link>
      </AuthLayout>
    )
  }

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <Spinner className="h-4 w-4 text-accent" />
          Carregando...
        </div>
      </AuthLayout>
    )
  }

  // Sem sessão de recuperação ativa (link já usado, expirado, ou a página
  // foi aberta diretamente sem passar pelo e-mail).
  if (!user) {
    return (
      <AuthLayout>
        <h2 className="text-lg font-semibold text-navy">Link inválido ou expirado</h2>
        <p className="mt-2 text-sm text-gray-600">
          Solicite um novo link de recuperação de senha.
        </p>
        <Link
          to="/esqueci-senha"
          className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
        >
          Solicitar novo link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h2 className="text-lg font-semibold text-navy">Definir nova senha</h2>
      <p className="mt-1 mb-6 text-sm text-gray-500">Escolha uma nova senha para sua conta.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="senha" className="mb-1 block text-sm font-medium text-gray-700">
          Nova senha
        </label>
        <input
          id="senha"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none"
        />

        <label htmlFor="confirmarSenha" className="mb-1 block text-sm font-medium text-gray-700">
          Confirmar nova senha
        </label>
        <input
          id="confirmarSenha"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={confirmarSenha}
          onChange={(event) => setConfirmarSenha(event.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none"
        />

        {error && <p className="mb-4 text-sm text-alert">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-navy px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
        >
          {submitting && <Spinner className="h-4 w-4" />}
          {submitting ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </AuthLayout>
  )
}
