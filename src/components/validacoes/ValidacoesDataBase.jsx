import { useMemo, useState } from 'react'
import { CONSIDERACOES, STATUS_ESCOPO, STATUS_ESCOPO_PADRAO } from '../../lib/validacoesData'
import Spinner from '../Spinner'
import Card from '../Card'

const FORM_ESCOPO_VAZIO = { numero_contrato: '', empresa: '', escopo: '', status: STATUS_ESCOPO_PADRAO }
const FORM_SEMANAL_VAZIO = {
  data_recebimento: '',
  validado_planejamento: false,
  validado_especialista: false,
  sharepoint: false,
  consideracao: CONSIDERACOES[0].valor,
}

const COR_STATUS_ESCOPO = {
  Ativa: 'bg-success/10 text-success',
  Concluída: 'bg-navy/10 text-navy dark:bg-slate-100/10 dark:text-slate-200',
  Paralisada: 'bg-alert/10 text-alert',
}

function formatarDataHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

// data_recebimento é uma coluna `date` pura ('YYYY-MM-DD', sem hora/fuso)
// — formata direto dos componentes do texto, sem passar por `new Date()`
// (que interpretaria como UTC e poderia voltar um dia).
function formatarDataBR(dataISO) {
  if (!dataISO) return '—'
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

function Checkzinho({ marcado, rotulo }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        marcado ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500'
      }`}
    >
      {marcado ? '✓' : '·'} {rotulo}
    </span>
  )
}

function CampoEscopoForm({ valores, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input
        type="text"
        placeholder="Contrato (opcional)"
        value={valores.numero_contrato}
        onChange={(event) => onChange({ ...valores, numero_contrato: event.target.value })}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
      />
      <input
        type="text"
        placeholder="Empresa"
        value={valores.empresa}
        onChange={(event) => onChange({ ...valores, empresa: event.target.value })}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
      />
      <input
        type="text"
        placeholder="Escopo"
        value={valores.escopo}
        onChange={(event) => onChange({ ...valores, escopo: event.target.value })}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
      />
      <select
        value={valores.status}
        onChange={(event) => onChange({ ...valores, status: event.target.value })}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
      >
        {STATUS_ESCOPO.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </div>
  )
}

// Usado tanto pra criar uma validação semanal nova quanto pra editar uma
// já existente (`valoresIniciais` vem preenchida com o registro atual
// nesse caso) — mesmo formulário, só muda o texto do botão e o que
// acontece no submit (ver EscopoCard).
function FormValidacaoSemanal({ valoresIniciais = FORM_SEMANAL_VAZIO, textoSalvar = 'Salvar validação', onCancelar, onSalvar, salvando }) {
  const [form, setForm] = useState(valoresIniciais)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSalvar(form)
      }}
      className="mt-3 flex flex-col gap-3 rounded-lg border border-dashed border-gray-300 p-3 dark:border-slate-600"
    >
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
          Data de recebimento do avanço
        </label>
        <input
          type="date"
          required
          value={form.data_recebimento}
          onChange={(event) => setForm((f) => ({ ...f, data_recebimento: event.target.value }))}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.validado_planejamento}
            onChange={(event) => setForm((f) => ({ ...f, validado_planejamento: event.target.checked }))}
            className="rounded border-gray-300 text-accent focus:ring-accent dark:border-slate-500 dark:bg-slate-700"
          />
          Validado pelo Planejamento
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.validado_especialista}
            onChange={(event) => setForm((f) => ({ ...f, validado_especialista: event.target.checked }))}
            className="rounded border-gray-300 text-accent focus:ring-accent dark:border-slate-500 dark:bg-slate-700"
          />
          Validado pelo Especialista
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.sharepoint}
            onChange={(event) => setForm((f) => ({ ...f, sharepoint: event.target.checked }))}
            className="rounded border-gray-300 text-accent focus:ring-accent dark:border-slate-500 dark:bg-slate-700"
          />
          Sharepoint
        </label>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
          Consideração
        </label>
        <select
          value={form.consideracao}
          onChange={(event) => setForm((f) => ({ ...f, consideracao: event.target.value }))}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none"
        >
          {CONSIDERACOES.map((item) => (
            <option key={item.valor} value={item.valor}>
              {item.valor}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
          {CONSIDERACOES.find((item) => item.valor === form.consideracao)?.descricao}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {salvando && <Spinner className="h-3.5 w-3.5 text-white" />}
          {textoSalvar}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={salvando}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

// numero_contrato é opcional — pode vir null do banco. O formulário
// (input controlado) precisa sempre de string, nunca null, senão
// `.trim()` explode ao salvar sem tocar no campo e o React reclama de
// input controlado virando não-controlado.
function paraFormEscopo(escopo) {
  return { ...escopo, numero_contrato: escopo.numero_contrato ?? '' }
}

// Mais recente primeiro por data_recebimento (não pela ordem de criação) —
// cobre o caso de cadastro retroativo (validação de uma semana anterior
// registrada depois de uma mais recente já existir). 'YYYY-MM-DD' compara
// certo como string. Em empate na data, mantém a ordem original (sort é
// estável), que já vem por criado_em desc de fetchTodasValidacoesSemanais.
function ordenarSemanaisPorDataRecebimento(semanais) {
  return [...semanais].sort((a, b) => (a.data_recebimento < b.data_recebimento ? 1 : a.data_recebimento > b.data_recebimento ? -1 : 0))
}

function EscopoCard({
  escopo,
  semanais,
  onAtualizar,
  onRemover,
  onAdicionarSemanal,
  onEditarSemanal,
  onRemoverSemanal,
}) {
  const semanaisOrdenadas = useMemo(() => ordenarSemanaisPorDataRecebimento(semanais), [semanais])

  const [editando, setEditando] = useState(false)
  const [formEdicao, setFormEdicao] = useState(() => paraFormEscopo(escopo))
  const [salvandoEscopo, setSalvandoEscopo] = useState(false)
  const [erroEscopo, setErroEscopo] = useState(null)

  const [mostrarFormSemanal, setMostrarFormSemanal] = useState(false)
  const [salvandoSemanal, setSalvandoSemanal] = useState(false)
  const [erroSemanal, setErroSemanal] = useState(null)
  const [removendoId, setRemovendoId] = useState(null)

  // Registro em edição (id) — null quando nenhum está sendo editado.
  const [editandoSemanalId, setEditandoSemanalId] = useState(null)
  const [salvandoEdicaoSemanal, setSalvandoEdicaoSemanal] = useState(false)

  async function salvarEdicao() {
    if (!formEdicao.empresa.trim() || !formEdicao.escopo.trim()) {
      setErroEscopo('Empresa e escopo são obrigatórios.')
      return
    }
    setSalvandoEscopo(true)
    setErroEscopo(null)
    try {
      await onAtualizar(escopo.id, {
        numero_contrato: formEdicao.numero_contrato.trim() || null,
        empresa: formEdicao.empresa.trim(),
        escopo: formEdicao.escopo.trim(),
        status: formEdicao.status,
      })
      setEditando(false)
    } catch (err) {
      setErroEscopo(err.message)
    } finally {
      setSalvandoEscopo(false)
    }
  }

  async function excluirEscopo() {
    const confirmado = window.confirm(
      `Excluir o escopo "${escopo.empresa} — ${escopo.escopo}"? Isso também apaga todo o histórico de validações semanais dele.`,
    )
    if (!confirmado) return
    setSalvandoEscopo(true)
    try {
      await onRemover(escopo.id)
    } catch (err) {
      setErroEscopo(err.message)
      setSalvandoEscopo(false)
    }
  }

  async function salvarNovaValidacao(form) {
    setSalvandoSemanal(true)
    setErroSemanal(null)
    try {
      await onAdicionarSemanal(escopo.id, form)
      setMostrarFormSemanal(false)
    } catch (err) {
      setErroSemanal(err.message)
    } finally {
      setSalvandoSemanal(false)
    }
  }

  async function salvarEdicaoSemanal(id, form) {
    setSalvandoEdicaoSemanal(true)
    setErroSemanal(null)
    try {
      await onEditarSemanal(escopo.id, id, form)
      setEditandoSemanalId(null)
    } catch (err) {
      setErroSemanal(err.message)
    } finally {
      setSalvandoEdicaoSemanal(false)
    }
  }

  async function excluirSemanal(id) {
    const confirmado = window.confirm('Excluir este registro de validação semanal?')
    if (!confirmado) return
    setRemovendoId(id)
    try {
      await onRemoverSemanal(escopo.id, id)
    } catch (err) {
      setErroSemanal(err.message)
    } finally {
      setRemovendoId(null)
    }
  }

  return (
    <Card faixaCor={escopo.status === 'Ativa' ? '#178a54' : escopo.status === 'Paralisada' ? '#d1495b' : '#12263f'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {editando ? (
            <CampoEscopoForm valores={formEdicao} onChange={setFormEdicao} />
          ) : (
            <>
              <p className="font-medium text-navy dark:text-slate-100">
                {escopo.empresa} <span className="text-gray-400 dark:text-slate-500">—</span> {escopo.escopo}
              </p>
              <p className="mt-0.5 text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500">
                Contrato {escopo.numero_contrato || '—'} ·{' '}
                <span className={`rounded-full px-1.5 py-0.5 ${COR_STATUS_ESCOPO[escopo.status]}`}>
                  {escopo.status}
                </span>{' '}
                · {semanais.length} validaç{semanais.length === 1 ? 'ão' : 'ões'}
              </p>
            </>
          )}
          {erroEscopo && <p className="mt-2 text-sm text-alert">{erroEscopo}</p>}
        </div>

        <div className="flex shrink-0 gap-2">
          {editando ? (
            <>
              <button
                type="button"
                onClick={salvarEdicao}
                disabled={salvandoEscopo}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {salvandoEscopo && <Spinner className="h-3 w-3 text-white" />}
                Salvar
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditando(false)
                  setFormEdicao(paraFormEscopo(escopo))
                  setErroEscopo(null)
                }}
                disabled={salvandoEscopo}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Editar dados
              </button>
              <button
                type="button"
                onClick={excluirEscopo}
                disabled={salvandoEscopo}
                className="rounded-md border border-alert/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-alert hover:bg-alert/5 disabled:opacity-50"
              >
                Excluir
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-3 dark:border-slate-700">
        {semanaisOrdenadas.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">Nenhuma validação semanal registrada ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {semanaisOrdenadas.map((registro) =>
              registro.id === editandoSemanalId ? (
                <li key={registro.id} className="rounded-lg border border-dashed border-accent/40 bg-accent/5 p-3">
                  <FormValidacaoSemanal
                    valoresIniciais={{
                      data_recebimento: registro.data_recebimento,
                      validado_planejamento: registro.validado_planejamento,
                      validado_especialista: registro.validado_especialista,
                      sharepoint: registro.sharepoint,
                      consideracao: registro.consideracao,
                    }}
                    textoSalvar="Salvar edição"
                    salvando={salvandoEdicaoSemanal}
                    onCancelar={() => {
                      setEditandoSemanalId(null)
                      setErroSemanal(null)
                    }}
                    onSalvar={(form) => salvarEdicaoSemanal(registro.id, form)}
                  />
                </li>
              ) : (
                <li
                  key={registro.id}
                  className="flex flex-col gap-1.5 rounded-lg border border-gray-100 bg-gray-50/60 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-700/30"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-navy dark:text-slate-100">
                        Avanço de {formatarDataBR(registro.data_recebimento)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-slate-500">
                        registrado em {formatarDataHora(registro.criado_em)}
                      </span>
                      <Checkzinho marcado={registro.validado_planejamento} rotulo="Planejamento" />
                      <Checkzinho marcado={registro.validado_especialista} rotulo="Especialista" />
                      <Checkzinho marcado={registro.sharepoint} rotulo="Sharepoint" />
                    </div>
                    <p className="mt-1 text-sm text-navy dark:text-slate-100">{registro.consideracao}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      Registrado por {registro.criado_por_nome || registro.criado_por_email || 'usuário removido'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-3 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => setEditandoSemanalId(registro.id)}
                      disabled={removendoId === registro.id}
                      className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => excluirSemanal(registro.id)}
                      disabled={removendoId === registro.id}
                      className="text-xs font-medium text-alert hover:underline disabled:opacity-50"
                    >
                      {removendoId === registro.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}

        {erroSemanal && <p className="mt-2 text-sm text-alert">{erroSemanal}</p>}

        {mostrarFormSemanal ? (
          <FormValidacaoSemanal
            salvando={salvandoSemanal}
            onCancelar={() => {
              setMostrarFormSemanal(false)
              setErroSemanal(null)
            }}
            onSalvar={salvarNovaValidacao}
          />
        ) : (
          <button
            type="button"
            onClick={() => setMostrarFormSemanal(true)}
            disabled={Boolean(editandoSemanalId)}
            className="mt-3 text-sm font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Nova validação semanal
          </button>
        )}
      </div>
    </Card>
  )
}

/**
 * Aba "Data_Base": cadastro de escopos + histórico de validações semanais
 * por escopo. Não busca dados por conta própria — recebe tudo pronto do
 * pai (Validacoes.jsx), que também é dono da aba Dashboard/Resumo; assim
 * as duas abas sempre enxergam o mesmo estado (sem refetch ao trocar de
 * aba, sem dashboard desatualizado depois de um CRUD aqui).
 */
export default function ValidacoesDataBase({
  escopos,
  semanaisPorEscopo,
  onAdicionarEscopo,
  onAtualizarEscopo,
  onRemoverEscopo,
  onAdicionarSemanal,
  onEditarSemanal,
  onRemoverSemanal,
}) {
  const [filtroTexto, setFiltroTexto] = useState('')
  const [formEscopo, setFormEscopo] = useState(FORM_ESCOPO_VAZIO)
  const [criandoEscopo, setCriandoEscopo] = useState(false)
  const [erroFormEscopo, setErroFormEscopo] = useState(null)

  const escoposExibidos = useMemo(() => {
    const termo = filtroTexto.trim().toLowerCase()
    const filtrados = !termo
      ? escopos
      : escopos.filter((escopo) => {
          const campos = [escopo.numero_contrato, escopo.empresa, escopo.escopo, escopo.status]
          return campos.some((valor) => (valor ?? '').toString().toLowerCase().includes(termo))
        })
    // Sempre A-Z por empresa, recalculado a cada render (não é ordenação
    // manual) — assim novos escopos entram no lugar certo automaticamente,
    // não importa a ordem de cadastro.
    return [...filtrados].sort((a, b) => a.empresa.localeCompare(b.empresa, 'pt-BR', { sensitivity: 'base' }))
  }, [escopos, filtroTexto])

  async function handleAdicionarEscopo(event) {
    event.preventDefault()
    setErroFormEscopo(null)

    if (!formEscopo.empresa.trim() || !formEscopo.escopo.trim()) {
      setErroFormEscopo('Empresa e escopo são obrigatórios.')
      return
    }

    setCriandoEscopo(true)
    try {
      await onAdicionarEscopo({
        numero_contrato: formEscopo.numero_contrato.trim() || null,
        empresa: formEscopo.empresa.trim(),
        escopo: formEscopo.escopo.trim(),
        status: formEscopo.status,
      })
      setFormEscopo(FORM_ESCOPO_VAZIO)
    } catch (err) {
      setErroFormEscopo(err.message)
    } finally {
      setCriandoEscopo(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card faixaCor="#2f6fed" categoria="Cadastro" titulo="Novo escopo">
        <form onSubmit={handleAdicionarEscopo} className="flex flex-col gap-3">
          <CampoEscopoForm valores={formEscopo} onChange={setFormEscopo} />
          <div>
            <button
              type="submit"
              disabled={criandoEscopo}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {criandoEscopo && <Spinner className="h-4 w-4 text-white" />}
              {criandoEscopo ? 'Adicionando...' : '+ Adicionar escopo'}
            </button>
          </div>
          {erroFormEscopo && <p className="text-sm text-alert">{erroFormEscopo}</p>}
        </form>
      </Card>

      <input
        type="text"
        value={filtroTexto}
        onChange={(event) => setFiltroTexto(event.target.value)}
        placeholder="Buscar por contrato, empresa, escopo ou status..."
        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
      />

      {escoposExibidos.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {escopos.length === 0 ? 'Nenhum escopo cadastrado ainda.' : 'Nenhum escopo encontrado com esse filtro.'}
        </p>
      ) : (
        escoposExibidos.map((escopo) => (
          <EscopoCard
            key={escopo.id}
            escopo={escopo}
            semanais={semanaisPorEscopo.get(escopo.id) ?? []}
            onAtualizar={onAtualizarEscopo}
            onRemover={onRemoverEscopo}
            onAdicionarSemanal={onAdicionarSemanal}
            onEditarSemanal={onEditarSemanal}
            onRemoverSemanal={onRemoverSemanal}
          />
        ))
      )}
    </div>
  )
}
