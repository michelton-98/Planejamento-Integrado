import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import Spinner from '../components/Spinner'
import Card from '../components/Card'

export default function Cadastro() {
  const { user, signUp } = useAuth()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [funcao, setFuncao] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Já autenticado: não faz sentido mostrar o cadastro.
  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error } = await signUp(email, password, { nome, funcao })

    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <Card faixaCor="#178a54" className="w-full max-w-sm" contentClassName="p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-navy">Cadastro enviado</h2>
          <p className="mb-4 text-sm text-gray-600">
            Se a confirmação por e-mail estiver ativada, verifique sua caixa de entrada para
            confirmar a conta. Em seguida, seu acesso ficará pendente até que um administrador
            aprove seu cadastro.
          </p>
          <Link to="/login" className="text-sm font-medium text-accent hover:underline">
            Ir para o login
          </Link>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card
        as="form"
        onSubmit={handleSubmit}
        faixaCor="#12263f"
        className="w-full max-w-sm"
        contentClassName="p-6"
      >
        <h2 className="mb-6 text-lg font-semibold text-navy">Criar conta</h2>

        <label htmlFor="nome" className="mb-1 block text-sm font-medium text-gray-700">
          Nome
        </label>
        <input
          id="nome"
          type="text"
          required
          autoComplete="name"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none"
        />

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
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none"
        />

        <label htmlFor="funcao" className="mb-1 block text-sm font-medium text-gray-700">
          Função
        </label>
        <input
          id="funcao"
          type="text"
          required
          placeholder="Ex.: Engenheiro de obra"
          value={funcao}
          onChange={(event) => setFuncao(event.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none"
        />

        {error && <p className="mb-4 text-sm text-alert">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy/90 disabled:opacity-50"
        >
          {submitting && <Spinner className="h-4 w-4" />}
          {submitting ? 'Enviando...' : 'Cadastrar'}
        </button>

        <p className="text-center text-sm text-gray-600">
          Já tem uma conta?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </main>
  )
}
