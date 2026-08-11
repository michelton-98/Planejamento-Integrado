import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/AuthContext'
import Spinner from '../../components/Spinner'
import Card from '../../components/Card'

const ORDEM_STATUS = { pendente: 0, aprovado: 1, recusado: 2 }

const ROTULO_STATUS = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
}

const COR_STATUS = {
  pendente: 'bg-gold/10 text-gold',
  aprovado: 'bg-success/10 text-success',
  recusado: 'bg-alert/10 text-alert',
}

function Badge({ className, children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}

// Gestão de Usuários (/admin/usuarios): lista todos os perfis (não só os
// pendentes, como a antiga tela de Aprovações) e concentra as ações de
// aprovar/recusar, promover/rebaixar admin e excluir conta. A conta
// is_master nunca pode perder o acesso de admin nem ser excluída — a regra
// de verdade mora no banco (trigger na tabela perfis + checagem na Edge
// Function de exclusão); aqui a UI só reflete isso desabilitando os botões.
export default function AdminUsuarios() {
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [processandoId, setProcessandoId] = useState(null)
  const [excluindoId, setExcluindoId] = useState(null)
  // Checkbox "conceder admin" por cadastro pendente, marcada antes de
  // clicar em Aprovar.
  const [concederAdmin, setConcederAdmin] = useState({})

  const carregarUsuarios = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('perfis')
      .select('id, nome, email, funcao, status_aprovacao, is_admin, is_master, criado_em')
      .order('criado_em', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      setUsuarios(data)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    carregarUsuarios()
  }, [carregarUsuarios])

  const usuariosOrdenados = useMemo(
    () =>
      [...usuarios].sort((a, b) => {
        const diffStatus = ORDEM_STATUS[a.status_aprovacao] - ORDEM_STATUS[b.status_aprovacao]
        if (diffStatus !== 0) return diffStatus
        return (a.nome || a.email || '').localeCompare(b.nome || b.email || '', 'pt-BR')
      }),
    [usuarios],
  )

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

    const { data, error } = await supabase
      .from('perfis')
      .update(payload)
      .eq('id', id)
      .select('id, nome, email, funcao, status_aprovacao, is_admin, is_master, criado_em')
      .single()

    setProcessandoId(null)

    if (error) {
      setError(error.message)
      return
    }

    setUsuarios((atual) => atual.map((usuario) => (usuario.id === id ? data : usuario)))
    setConcederAdmin((atual) => {
      const { [id]: _removido, ...resto } = atual
      return resto
    })
  }

  async function alternarAdmin(usuario) {
    setProcessandoId(usuario.id)
    setError(null)

    const { data, error } = await supabase
      .from('perfis')
      .update({ is_admin: !usuario.is_admin })
      .eq('id', usuario.id)
      .select('id, nome, email, funcao, status_aprovacao, is_admin, is_master, criado_em')
      .single()

    setProcessandoId(null)

    if (error) {
      // Aqui cai, por exemplo, a exceção do trigger que protege contas
      // master de perderem o acesso de administrador.
      setError(error.message)
      return
    }

    setUsuarios((atual) => atual.map((item) => (item.id === usuario.id ? data : item)))
  }

  async function excluirUsuario(usuario) {
    const confirmado = window.confirm(
      `Excluir o usuário "${usuario.nome || usuario.email}"? Essa ação remove o cadastro e o acesso ao sistema, e não pode ser desfeita.`,
    )
    if (!confirmado) return

    setExcluindoId(usuario.id)
    setError(null)

    const { data, error } = await supabase.functions.invoke('excluir-usuario', {
      body: { id: usuario.id },
    })

    setExcluindoId(null)

    // supabase.functions.invoke não rejeita em respostas 4xx/5xx da own
    // function — o corpo de erro vem em data.error (ver excluir-usuario).
    const mensagemErro = error?.message || data?.error
    if (mensagemErro) {
      setError(mensagemErro)
      return
    }

    setUsuarios((atual) => atual.filter((item) => item.id !== usuario.id))
  }

  return (
    <main className="flex-1 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-1 text-lg font-semibold text-navy">Gestão de Usuários</h2>
        <p className="mb-6 text-sm text-gray-500">
          Aprove cadastros, gerencie quem tem acesso de administrador e remova contas.
        </p>

        {error && <p className="mb-4 text-sm text-alert">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Spinner className="h-4 w-4" />
            Carregando...
          </div>
        ) : usuariosOrdenados.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum usuário cadastrado.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {usuariosOrdenados.map((usuario) => {
              const pendente = usuario.status_aprovacao === 'pendente'
              const processando = processandoId === usuario.id
              const excluindo = excluindoId === usuario.id
              const vocêMesmo = usuario.id === user?.id

              return (
                <Card
                  as="li"
                  key={usuario.id}
                  faixaCor={
                    usuario.status_aprovacao === 'pendente'
                      ? '#a9791f'
                      : usuario.status_aprovacao === 'recusado'
                        ? '#d1495b'
                        : '#178a54'
                  }
                  contentClassName="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-navy">{usuario.nome || '(sem nome)'}</p>
                      {vocêMesmo && <Badge className="bg-accent/10 text-accent">Você</Badge>}
                      <Badge className={COR_STATUS[usuario.status_aprovacao]}>
                        {ROTULO_STATUS[usuario.status_aprovacao] || usuario.status_aprovacao}
                      </Badge>
                      {usuario.is_admin && <Badge className="bg-navy/10 text-navy">Admin</Badge>}
                      {usuario.is_master && <Badge className="bg-gold/10 text-gold">Master</Badge>}
                    </div>
                    <p className="text-sm text-gray-600">{usuario.email}</p>
                    <p className="text-sm text-gray-500">{usuario.funcao || '(sem função)'}</p>
                  </div>

                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    {pendente ? (
                      <>
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={Boolean(concederAdmin[usuario.id])}
                            onChange={() => alternarConcederAdmin(usuario.id)}
                            disabled={processando}
                            className="rounded border-gray-300 text-accent focus:ring-accent"
                          />
                          Conceder acesso de administrador
                        </label>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={processando}
                            onClick={() => definirStatus(usuario.id, 'aprovado')}
                            className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {processando && <Spinner className="h-3.5 w-3.5" />}
                            Aprovar
                          </button>
                          <button
                            type="button"
                            disabled={processando}
                            onClick={() => definirStatus(usuario.id, 'recusado')}
                            className="inline-flex items-center gap-1.5 rounded-md bg-alert px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {processando && <Spinner className="h-3.5 w-3.5" />}
                            Recusar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={processando || (usuario.is_master && usuario.is_admin)}
                          title={
                            usuario.is_master && usuario.is_admin
                              ? 'Contas master não podem perder o acesso de administrador.'
                              : undefined
                          }
                          onClick={() => alternarAdmin(usuario)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {processando && <Spinner className="h-3.5 w-3.5" />}
                          {usuario.is_admin ? 'Rebaixar a usuário comum' : 'Promover a administrador'}
                        </button>
                        <button
                          type="button"
                          disabled={excluindo || usuario.is_master || vocêMesmo}
                          title={
                            usuario.is_master
                              ? 'Contas master não podem ser excluídas.'
                              : vocêMesmo
                                ? 'Você não pode excluir sua própria conta por aqui.'
                                : undefined
                          }
                          onClick={() => excluirUsuario(usuario)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-alert px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {excluindo && <Spinner className="h-3.5 w-3.5" />}
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
