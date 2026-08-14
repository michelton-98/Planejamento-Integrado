import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/AuthContext'
import { FERRAMENTAS } from '../../lib/ferramentas'
import Spinner from '../../components/Spinner'
import Card from '../../components/Card'

const SELECT_USUARIOS =
  'id, nome, email, funcao, status_aprovacao, is_admin, is_master, ferramentas_permitidas, pode_importar_rdos, criado_em'

// Ferramentas elegíveis pro checklist de "Personalizar Acesso": vem do
// mesmo catálogo usado pra montar os cards do Painel (ferramentas.jsx),
// menos as `somenteAdmin` (ex.: "Gestão de Usuários") — essas já são
// liberadas automaticamente só pra admins, fora desse mecanismo. Assim,
// uma ferramenta nova cadastrada em FERRAMENTAS aparece aqui sozinha, sem
// precisar tocar nesta tela.
const FERRAMENTAS_PERSONALIZAVEIS = FERRAMENTAS.filter((ferramenta) => !ferramenta.somenteAdmin)

// Ordem de exibição: conta Master primeiro, depois Admins, depois
// usuários comuns — dentro de cada grupo, ordem alfabética (ver
// usuariosOrdenados abaixo). Pendentes/recusados não formam mais um grupo
// à parte; entram no grupo de "comuns" (nenhum pendente/recusado é admin).
function grupoUsuario(usuario) {
  if (usuario.is_master) return 0
  if (usuario.is_admin) return 1
  return 2
}

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
  const { user, profile } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [processandoId, setProcessandoId] = useState(null)
  const [excluindoId, setExcluindoId] = useState(null)
  // Checkbox "conceder admin" por cadastro pendente, marcada antes de
  // clicar em Aprovar.
  const [concederAdmin, setConcederAdmin] = useState({})

  // "Personalizar Acesso" (só a conta master vê/usa, ver profile?.is_master
  // abaixo): id do usuário com o painel de checkboxes aberto, seleção em
  // edição ({ [chave]: bool }) e estado de salvamento — tudo local até
  // clicar em Salvar.
  const [personalizandoId, setPersonalizandoId] = useState(null)
  const [selecaoFerramentas, setSelecaoFerramentas] = useState({})
  // Checkbox extra "Acesso à aba Importar RDOs" (independente do
  // checklist de ferramentas) — só faz sentido, e só é exibida, quando
  // 'rdo' está marcado no checklist acima (ver salvarPersonalizacao).
  const [selecaoImportarRdos, setSelecaoImportarRdos] = useState(false)
  const [salvandoPersonalizacao, setSalvandoPersonalizacao] = useState(false)
  const [erroPersonalizacao, setErroPersonalizacao] = useState(null)

  const carregarUsuarios = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('perfis')
      .select(SELECT_USUARIOS)
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
        const diffGrupo = grupoUsuario(a) - grupoUsuario(b)
        if (diffGrupo !== 0) return diffGrupo
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
      .select(SELECT_USUARIOS)
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
      .select(SELECT_USUARIOS)
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

  // Abre/fecha o painel de checkboxes pro usuário clicado. Ao abrir, marca
  // cada ferramenta cujo checklist reflita o estado atual: null/vazio em
  // ferramentas_permitidas = tudo marcado (acesso total, o padrão).
  function alternarPersonalizacao(usuario) {
    if (personalizandoId === usuario.id) {
      setPersonalizandoId(null)
      return
    }

    const permitidas = usuario.ferramentas_permitidas
    const acessoTotal = !permitidas || permitidas.length === 0
    const selecaoInicial = {}
    FERRAMENTAS_PERSONALIZAVEIS.forEach((ferramenta) => {
      selecaoInicial[ferramenta.chave] = acessoTotal || permitidas.includes(ferramenta.chave)
    })

    setSelecaoFerramentas(selecaoInicial)
    setSelecaoImportarRdos(Boolean(usuario.pode_importar_rdos))
    setErroPersonalizacao(null)
    setPersonalizandoId(usuario.id)
  }

  function alternarSelecaoFerramenta(chave) {
    setSelecaoFerramentas((atual) => {
      const proxima = { ...atual, [chave]: !atual[chave] }
      // Desmarcar 'rdo' esconde (e zera) o checkbox de Importar RDOs: não
      // faz sentido manter essa permissão pra quem nem acessa a ferramenta.
      if (chave === 'rdo' && !proxima.rdo) setSelecaoImportarRdos(false)
      return proxima
    })
  }

  async function salvarPersonalizacao(usuario) {
    const selecionadas = FERRAMENTAS_PERSONALIZAVEIS.filter((ferramenta) => selecaoFerramentas[ferramenta.chave]).map(
      (ferramenta) => ferramenta.chave,
    )

    if (selecionadas.length === 0) {
      setErroPersonalizacao('Selecione ao menos uma ferramenta.')
      return
    }

    setSalvandoPersonalizacao(true)
    setErroPersonalizacao(null)

    // Todas marcadas equivale a "sem personalização" — grava null em vez
    // do array cheio, pra ferramentas criadas no futuro entrarem
    // automaticamente no acesso total desse usuário (ver temAcessoFerramenta).
    const valor = selecionadas.length === FERRAMENTAS_PERSONALIZAVEIS.length ? null : selecionadas
    // Reforça a mesma regra na gravação: sem acesso a 'rdo', não grava
    // pode_importar_rdos = true por engano.
    const podeImportarRdosValor = Boolean(selecaoFerramentas.rdo && selecaoImportarRdos)

    const { data, error } = await supabase
      .from('perfis')
      .update({ ferramentas_permitidas: valor, pode_importar_rdos: podeImportarRdosValor })
      .eq('id', usuario.id)
      .select(SELECT_USUARIOS)
      .single()

    setSalvandoPersonalizacao(false)

    if (error) {
      // Aqui cai, por exemplo, a exceção do trigger que restringe esta
      // coluna à conta master (ver migration 0014).
      setErroPersonalizacao(error.message)
      return
    }

    setUsuarios((atual) => atual.map((item) => (item.id === usuario.id ? data : item)))
    setPersonalizandoId(null)
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
        <h2 className="mb-1 text-lg font-semibold text-navy dark:text-slate-100">Gestão de Usuários</h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-slate-400">
          Aprove cadastros, gerencie quem tem acesso de administrador e remova contas.
        </p>

        {error && <p className="mb-4 text-sm text-alert">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
            <Spinner className="h-4 w-4" />
            Carregando...
          </div>
        ) : usuariosOrdenados.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum usuário cadastrado.</p>
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
                  contentClassName="flex flex-col gap-3 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-navy dark:text-slate-100">{usuario.nome || '(sem nome)'}</p>
                      {vocêMesmo && <Badge className="bg-accent/10 text-accent">Você</Badge>}
                      <Badge className={COR_STATUS[usuario.status_aprovacao]}>
                        {ROTULO_STATUS[usuario.status_aprovacao] || usuario.status_aprovacao}
                      </Badge>
                      {usuario.is_admin && (
                        <Badge className="bg-navy/10 text-navy dark:bg-slate-100/10 dark:text-slate-200">Admin</Badge>
                      )}
                      {usuario.is_master && <Badge className="bg-gold/10 text-gold">Master</Badge>}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-slate-300">{usuario.email}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400">{usuario.funcao || '(sem função)'}</p>
                  </div>

                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    {pendente ? (
                      <>
                        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={Boolean(concederAdmin[usuario.id])}
                            onChange={() => alternarConcederAdmin(usuario.id)}
                            disabled={processando}
                            className="rounded border-gray-300 text-accent focus:ring-accent dark:border-slate-500 dark:bg-slate-700"
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
                          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          {processando && <Spinner className="h-3.5 w-3.5" />}
                          {usuario.is_admin ? 'Rebaixar a usuário comum' : 'Promover a administrador'}
                        </button>
                        {profile?.is_master && !usuario.is_admin && (
                          <button
                            type="button"
                            onClick={() => alternarPersonalizacao(usuario)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/5"
                          >
                            {personalizandoId === usuario.id ? 'Fechar personalização' : 'Personalizar Acesso'}
                          </button>
                        )}
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
                  </div>

                  {personalizandoId === usuario.id && (
                    <div className="rounded-lg border border-dashed border-accent/40 bg-accent/5 p-3 dark:border-accent/30">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Ferramentas liberadas no Painel para {usuario.nome || usuario.email}
                      </p>
                      <div className="flex flex-wrap gap-4">
                        {FERRAMENTAS_PERSONALIZAVEIS.map((ferramenta) => (
                          <label
                            key={ferramenta.chave}
                            className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(selecaoFerramentas[ferramenta.chave])}
                              onChange={() => alternarSelecaoFerramenta(ferramenta.chave)}
                              disabled={salvandoPersonalizacao}
                              className="rounded border-gray-300 text-accent focus:ring-accent dark:border-slate-500 dark:bg-slate-700"
                            />
                            {ferramenta.titulo}
                          </label>
                        ))}
                      </div>

                      {selecaoFerramentas.rdo && (
                        <label className="mt-3 flex items-center gap-2 border-t border-accent/20 pt-3 text-sm text-gray-700 dark:border-accent/20 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={selecaoImportarRdos}
                            onChange={() => setSelecaoImportarRdos((atual) => !atual)}
                            disabled={salvandoPersonalizacao}
                            className="rounded border-gray-300 text-accent focus:ring-accent dark:border-slate-500 dark:bg-slate-700"
                          />
                          Acesso à aba Importar RDOs
                        </label>
                      )}

                      {erroPersonalizacao && <p className="mt-2 text-sm text-alert">{erroPersonalizacao}</p>}

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={salvandoPersonalizacao}
                          onClick={() => salvarPersonalizacao(usuario)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
                        >
                          {salvandoPersonalizacao && <Spinner className="h-3 w-3 text-white" />}
                          Salvar
                        </button>
                        <button
                          type="button"
                          disabled={salvandoPersonalizacao}
                          onClick={() => setPersonalizandoId(null)}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
