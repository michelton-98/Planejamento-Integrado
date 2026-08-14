import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import {
  DISCIPLINAS,
  atualizarObraEscopo,
  fetchObrasEscopos,
  inserirObraEscopo,
  removerObraEscopo,
} from '../../lib/obrasEscoposData'
import { STATUS_OFICIAIS, STATUS_PADRAO } from '../../lib/obrasEscoposParser'
import Spinner from '../Spinner'
import Card from '../Card'

const FORM_VAZIO = { numero_contrato: '', empresa: '', escopo: '', disciplina: '', status: STATUS_PADRAO }

// Compara duas obras por `campo` para a ordenação clicável dos
// cabeçalhos: numérica para contrato (nulos sempre por último,
// independente da direção), alfabética (pt-BR) para o resto (nulos —
// caso de disciplina — também por último).
function compararObras(a, b, campo) {
  if (campo === 'numero_contrato') {
    const na = a.numero_contrato ? Number(a.numero_contrato) : null
    const nb = b.numero_contrato ? Number(b.numero_contrato) : null
    if (na === null && nb === null) return 0
    if (na === null) return 1
    if (nb === null) return -1
    return na - nb
  }

  const va = a[campo]
  const vb = b[campo]
  if (!va && vb) return 1
  if (va && !vb) return -1
  if (!va && !vb) return 0
  return String(va).localeCompare(String(vb), 'pt-BR')
}

/**
 * `prefill`: { numero_contrato, empresa, escopo } vindo do atalho "+
 * Cadastrar esta obra" de RdosSemObra.jsx — preenche o formulário de nova
 * obra abaixo da tabela. `onPrefillConsumido` avisa o pai que já
 * aplicamos o preenchimento (evita reaplicar em re-renders). `onMudanca`
 * avisa o pai (Input.jsx) que a lista de obras mudou, para outros
 * componentes (ex.: contador de RDOs sem obra) recalcularem.
 */
export default function ObrasEscoposTable({ prefill, onPrefillConsumido, onMudanca }) {
  const { profile } = useAuth()

  const [obras, setObras] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [salvandoId, setSalvandoId] = useState(null)
  const [erroLinhaId, setErroLinhaId] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [criando, setCriando] = useState(false)
  const [erroForm, setErroForm] = useState(null)

  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroDisciplina, setFiltroDisciplina] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [ordenacao, setOrdenacao] = useState({ campo: 'empresa', direcao: 'asc' })

  // Espelha os valores de texto já persistidos no banco (por id), para o
  // onBlur saber se algo mudou de fato antes de gravar.
  const originaisRef = useRef(new Map())
  const formRef = useRef(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)

    fetchObrasEscopos()
      .then((data) => {
        if (!ativo) return
        setObras(data)
        originaisRef.current = new Map(
          data.map((o) => [o.id, { numero_contrato: o.numero_contrato, empresa: o.empresa, escopo: o.escopo }]),
        )
      })
      .catch((err) => {
        if (ativo) setError(err.message)
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (!prefill) return
    setForm((f) => ({
      ...f,
      numero_contrato: prefill.numero_contrato ?? '',
      empresa: prefill.empresa ?? '',
      escopo: prefill.escopo ?? '',
    }))
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    onPrefillConsumido?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill])

  // Defesa em profundidade: /input já é uma rota AdminRoute, mas essa
  // tabela editável não deve renderizar (nem tentar escrever) para quem
  // não é admin.
  if (!profile?.is_admin) return null

  async function handleCampoChange(obra, campo, valor) {
    setSalvandoId(obra.id)
    setErroLinhaId(null)

    const anterior = obras
    setObras((atual) => atual.map((o) => (o.id === obra.id ? { ...o, [campo]: valor } : o)))

    try {
      await atualizarObraEscopo(obra.id, { [campo]: valor })
      onMudanca?.()
    } catch (err) {
      setObras(anterior)
      setErroLinhaId(obra.id)
      console.error('Erro ao salvar obra:', err.message)
    } finally {
      setSalvandoId(null)
    }
  }

  // Digitar só atualiza a UI local — o commit (chamada ao Supabase)
  // acontece em handleTextoBlur, ao sair do campo.
  function handleTextoChange(obraId, campo, valor) {
    setObras((atual) => atual.map((o) => (o.id === obraId ? { ...o, [campo]: valor } : o)))
  }

  async function handleTextoBlur(obra, campo) {
    const original = originaisRef.current.get(obra.id)
    if (!original) return

    let valorAtual = obra[campo]

    if (campo === 'numero_contrato') {
      valorAtual = valorAtual?.trim() || null
    } else {
      valorAtual = (valorAtual ?? '').trim()
      if (!valorAtual) {
        // Empresa/escopo são obrigatórios: reverte sem salvar.
        setObras((atual) =>
          atual.map((o) => (o.id === obra.id ? { ...o, [campo]: original[campo] } : o)),
        )
        setErroLinhaId(obra.id)
        return
      }
    }

    if (original[campo] === valorAtual) return

    setSalvandoId(obra.id)
    setErroLinhaId(null)

    try {
      await atualizarObraEscopo(obra.id, { [campo]: valorAtual })
      setObras((atual) => atual.map((o) => (o.id === obra.id ? { ...o, [campo]: valorAtual } : o)))
      originaisRef.current.set(obra.id, { ...original, [campo]: valorAtual })
      onMudanca?.()
    } catch (err) {
      setObras((atual) =>
        atual.map((o) => (o.id === obra.id ? { ...o, [campo]: original[campo] } : o)),
      )
      setErroLinhaId(obra.id)
      console.error('Erro ao salvar obra:', err.message)
    } finally {
      setSalvandoId(null)
    }
  }

  async function handleRemover(obra) {
    setSalvandoId(obra.id)
    const anterior = obras
    setObras((atual) => atual.filter((o) => o.id !== obra.id))

    try {
      await removerObraEscopo(obra.id)
      originaisRef.current.delete(obra.id)
      onMudanca?.()
    } catch (err) {
      setObras(anterior)
      setErroLinhaId(obra.id)
      console.error('Erro ao remover obra:', err.message)
    } finally {
      setSalvandoId(null)
    }
  }

  async function handleAdicionar(event) {
    event.preventDefault()
    setErroForm(null)

    if (!form.empresa.trim() || !form.escopo.trim()) {
      setErroForm('Empresa e escopo são obrigatórios.')
      return
    }

    setCriando(true)
    try {
      const nova = await inserirObraEscopo({
        numero_contrato: form.numero_contrato.trim() || null,
        empresa: form.empresa.trim(),
        escopo: form.escopo.trim(),
        disciplina: form.disciplina || null,
        status: form.status,
      })
      setObras((atual) => [...atual, nova])
      originaisRef.current.set(nova.id, {
        numero_contrato: nova.numero_contrato,
        empresa: nova.empresa,
        escopo: nova.escopo,
      })
      setForm(FORM_VAZIO)
      onMudanca?.()
    } catch (err) {
      setErroForm(err.message)
    } finally {
      setCriando(false)
    }
  }

  const obrasExibidas = useMemo(() => {
    const termo = filtroTexto.trim().toLowerCase()

    let resultado = obras.filter((obra) => {
      if (filtroDisciplina && obra.disciplina !== filtroDisciplina) return false
      if (filtroStatus && obra.status !== filtroStatus) return false
      if (!termo) return true

      const campos = [obra.numero_contrato, obra.empresa, obra.escopo, obra.disciplina, obra.status]
      return campos.some((valor) => (valor ?? '').toString().toLowerCase().includes(termo))
    })

    if (ordenacao.campo) {
      resultado = [...resultado].sort((a, b) => {
        const cmp = compararObras(a, b, ordenacao.campo)
        return ordenacao.direcao === 'desc' ? -cmp : cmp
      })
    }

    return resultado
  }, [obras, filtroTexto, filtroDisciplina, filtroStatus, ordenacao])

  function handleOrdenar(campo) {
    setOrdenacao((atual) =>
      atual.campo === campo
        ? { campo, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
        : { campo, direcao: 'asc' },
    )
  }

  function ThOrdenavel({ campo, children }) {
    const ativo = ordenacao.campo === campo
    return (
      <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">
        <button
          type="button"
          onClick={() => handleOrdenar(campo)}
          className="inline-flex items-center gap-1 hover:text-navy dark:hover:text-slate-100"
        >
          {children}
          <span className="text-[10px] text-gray-400 dark:text-slate-500">
            {ativo ? (ordenacao.direcao === 'asc' ? '▲' : '▼') : '⇅'}
          </span>
        </button>
      </th>
    )
  }

  function CampoTexto({ obra, campo, placeholder }) {
    return (
      <input
        type="text"
        value={obra[campo] ?? ''}
        placeholder={placeholder}
        onChange={(event) => handleTextoChange(obra.id, campo, event.target.value)}
        onBlur={() => handleTextoBlur(obra, campo)}
        disabled={salvandoId === obra.id}
        className="w-full min-w-[7rem] rounded-md border border-transparent px-2 py-1 text-sm text-navy hover:border-gray-300 focus:border-accent focus:outline-none disabled:opacity-50 dark:text-slate-100 dark:hover:border-slate-600"
      />
    )
  }

  return (
    <Card faixaCor="#2f6fed" categoria="Cadastro" titulo="Obras cadastradas" className="mb-6">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          <Spinner className="h-4 w-4 text-accent" />
          Carregando obras...
        </div>
      ) : error ? (
        <p className="text-sm text-alert">{error}</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={filtroTexto}
              onChange={(event) => setFiltroTexto(event.target.value)}
              placeholder="Buscar por contrato, empresa ou escopo..."
              className="min-w-[16rem] flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <select
              value={filtroDisciplina}
              onChange={(event) => setFiltroDisciplina(event.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
            >
              <option value="">Todas as disciplinas</option>
              {DISCIPLINAS.map((disciplina) => (
                <option key={disciplina} value={disciplina}>
                  {disciplina}
                </option>
              ))}
            </select>
            <select
              value={filtroStatus}
              onChange={(event) => setFiltroStatus(event.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
            >
              <option value="">Todos os status</option>
              {STATUS_OFICIAIS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            {(filtroTexto || filtroDisciplina || filtroStatus) && (
              <button
                type="button"
                onClick={() => {
                  setFiltroTexto('')
                  setFiltroDisciplina('')
                  setFiltroStatus('')
                }}
                className="text-xs font-medium text-accent hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>

          <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700/50">
                <tr>
                  <ThOrdenavel campo="numero_contrato">Contrato</ThOrdenavel>
                  <ThOrdenavel campo="empresa">Empresa</ThOrdenavel>
                  <ThOrdenavel campo="escopo">Escopo</ThOrdenavel>
                  <ThOrdenavel campo="disciplina">Disciplina</ThOrdenavel>
                  <ThOrdenavel campo="status">Status</ThOrdenavel>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
                {obrasExibidas.map((obra) => (
                  <tr key={obra.id}>
                    <td className="px-1 py-1">
                      <CampoTexto obra={obra} campo="numero_contrato" placeholder="—" />
                    </td>
                    <td className="px-1 py-1">
                      <CampoTexto obra={obra} campo="empresa" placeholder="Empresa" />
                    </td>
                    <td className="px-1 py-1">
                      <CampoTexto obra={obra} campo="escopo" placeholder="Escopo" />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={obra.disciplina ?? ''}
                        onChange={(event) =>
                          handleCampoChange(obra, 'disciplina', event.target.value || null)
                        }
                        disabled={salvandoId === obra.id}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-accent focus:outline-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
                      >
                        <option value="">—</option>
                        {DISCIPLINAS.map((disciplina) => (
                          <option key={disciplina} value={disciplina}>
                            {disciplina}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={obra.status}
                        onChange={(event) => handleCampoChange(obra, 'status', event.target.value)}
                        disabled={salvandoId === obra.id}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-accent focus:outline-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
                      >
                        {STATUS_OFICIAIS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {salvandoId === obra.id && <Spinner className="h-4 w-4 text-accent" />}
                        {erroLinhaId === obra.id && (
                          <span className="text-xs text-alert">Erro ao salvar</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemover(obra)}
                          disabled={salvandoId === obra.id}
                          className="text-xs font-medium text-alert hover:underline disabled:opacity-50"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {obrasExibidas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-gray-500 dark:text-slate-400">
                      {obras.length === 0
                        ? 'Nenhuma obra cadastrada ainda.'
                        : 'Nenhuma obra encontrada com esse filtro.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <form
            ref={formRef}
            onSubmit={handleAdicionar}
            className="grid grid-cols-1 gap-3 rounded-lg border border-dashed border-gray-300 p-4 sm:grid-cols-2 lg:grid-cols-6 dark:border-slate-600"
          >
            <input
              type="text"
              placeholder="Contrato (opcional)"
              value={form.numero_contrato}
              onChange={(event) => setForm((f) => ({ ...f, numero_contrato: event.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <input
              type="text"
              placeholder="Empresa"
              value={form.empresa}
              onChange={(event) => setForm((f) => ({ ...f, empresa: event.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <input
              type="text"
              placeholder="Escopo"
              value={form.escopo}
              onChange={(event) => setForm((f) => ({ ...f, escopo: event.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <select
              value={form.disciplina}
              onChange={(event) => setForm((f) => ({ ...f, disciplina: event.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
            >
              <option value="">Disciplina —</option>
              {DISCIPLINAS.map((disciplina) => (
                <option key={disciplina} value={disciplina}>
                  {disciplina}
                </option>
              ))}
            </select>
            <select
              value={form.status}
              onChange={(event) => setForm((f) => ({ ...f, status: event.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
            >
              {STATUS_OFICIAIS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={criando}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {criando && <Spinner className="h-4 w-4 text-white" />}
              {criando ? 'Adicionando...' : '+ Adicionar obra'}
            </button>
            {erroForm && (
              <p className="col-span-full text-sm text-alert">{erroForm}</p>
            )}
          </form>
        </>
      )}
    </Card>
  )
}
