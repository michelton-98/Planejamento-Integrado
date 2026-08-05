import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Spinner from '../../components/Spinner'
import Card from '../../components/Card'

export default function Aprovacoes() {
  const [pendentes, setPendentes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [processandoId, setProcessandoId] = useState(null)
  // Checkbox "conceder admin" por cadastro pendente, marcada antes de
  // clicar em Aprovar (agora que /input é restrito a admins, precisa dar
  // pra promover alguém sem abrir o painel do Supabase).
  const [concederAdmin, setConcederAdmin] = useState({})

  const carregarPendentes = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('perfis')
      .select('id, nome, email, funcao, criado_em')
      .eq('status_aprovacao', 'pendente')
      .order('criado_em', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      setPendentes(data)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    carregarPendentes()
  }, [carregarPendentes])

  function alternarConcederAdmin(id) {
    setConcederAdmin((atual) => ({ ...atual, [id]: !atual[id] }))
  }

  async function definirStatus(id, status) {
    setProcessandoId(id)
    setError(null)

    // is_admin só é definido (e sobrescrito) na aprovação — recusar não
    // mexe nesse campo.
    const payload =
      status === 'aprovado'
        ? { status_aprovacao: status, is_admin: Boolean(concederAdmin[id]) }
        : { status_aprovacao: status }

    const { error } = await supabase.from('perfis').update(payload).eq('id', id)

    setProcessandoId(null)

    if (error) {
      setError(error.message)
      return
    }

    setPendentes((atual) => atual.filter((perfil) => perfil.id !== id))
    setConcederAdmin((atual) => {
      const { [id]: _removido, ...resto } = atual
      return resto
    })
  }

  return (
    <main className="flex-1 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-6 text-lg font-semibold text-navy">Cadastros pendentes de aprovação</h2>

        {error && <p className="mb-4 text-sm text-alert">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Spinner className="h-4 w-4" />
            Carregando...
          </div>
        ) : pendentes.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum cadastro pendente no momento.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {pendentes.map((perfil) => (
              <Card
                as="li"
                key={perfil.id}
                faixaCor="#a9791f"
                categoria="Cadastro pendente"
                contentClassName="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-navy">{perfil.nome || '(sem nome)'}</p>
                  <p className="text-sm text-gray-600">{perfil.email}</p>
                  <p className="text-sm text-gray-500">{perfil.funcao || '(sem função)'}</p>
                </div>

                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={Boolean(concederAdmin[perfil.id])}
                      onChange={() => alternarConcederAdmin(perfil.id)}
                      disabled={processandoId === perfil.id}
                      className="rounded border-gray-300 text-accent focus:ring-accent"
                    />
                    Conceder acesso de administrador
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={processandoId === perfil.id}
                      onClick={() => definirStatus(perfil.id, 'aprovado')}
                      className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {processandoId === perfil.id && <Spinner className="h-3.5 w-3.5" />}
                      Aprovar
                    </button>
                    <button
                      type="button"
                      disabled={processandoId === perfil.id}
                      onClick={() => definirStatus(perfil.id, 'recusado')}
                      className="inline-flex items-center gap-1.5 rounded-md bg-alert px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {processandoId === perfil.id && <Spinner className="h-3.5 w-3.5" />}
                      Recusar
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
