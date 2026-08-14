import { useState } from 'react'
import { AVANCO_CONFIG, DISCIPLINAS_AVANCO, escoposDaEmpresa } from '../../lib/avancoIntegradoConfig'
import { TAMANHO_MAXIMO_BYTES, enviarArquivoAvanco } from '../../lib/avancoIntegradoData'
import Card from '../Card'
import Spinner from '../Spinner'

function formatarDataBR(dataISO) {
  if (!dataISO) return '—'
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

// Card "meio apagado" de uma disciplina ainda não habilitada pra Input —
// mesmo espírito visual do sub-painel de fases (ver AvancoIntegrado.jsx).
function DisciplinaEmBreve({ disciplina }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white opacity-50 shadow-md shadow-gray-200/70 dark:bg-slate-800 dark:shadow-black/30">
      <div className="h-1.5 bg-accent" />
      <div className="flex min-h-[7rem] flex-col items-center justify-center p-6 text-center">
        <h3 className="text-base font-semibold text-navy dark:text-slate-100">{disciplina}</h3>
      </div>
      <span className="absolute right-3 top-3 rounded-full bg-navy/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white dark:bg-slate-700">
        Em breve
      </span>
    </div>
  )
}

// Aviso de confirmação antes de sobrescrever um arquivo já cadastrado pra
// essa combinação exata de Empresa + Escopo + Data — modal simples,
// centralizado, só com os dois botões pedidos (Cancelar / Substituir).
function ConfirmarSubstituicao({ pendente, onCancelar, onConfirmar, substituindo }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={substituindo ? undefined : onCancelar} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirmar substituição de arquivo"
        className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-800"
      >
        <h3 className="mb-2 text-base font-semibold text-navy dark:text-slate-100">Substituir arquivo existente?</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-slate-300">
          Já existe um arquivo enviado para <span className="font-medium">{pendente.empresa}</span> —{' '}
          <span className="font-medium">{pendente.escopo}</span> em{' '}
          <span className="font-medium">{formatarDataBR(pendente.dataReferencia)}</span> (
          {pendente.existente.nome_arquivo}). Deseja substituir pelo novo arquivo?
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={substituindo}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={substituindo}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {substituindo && <Spinner className="h-3.5 w-3.5 text-white" />}
            Substituir
          </button>
        </div>
      </div>
    </div>
  )
}

const FORM_VAZIO = { empresa: '', escopo: '', dataReferencia: '' }

// Formulário de upload da disciplina Metal — única habilitada por
// enquanto (ver AVANCO_CONFIG). `arquivos` é a lista já carregada da fase
// inteira (ver DestilariaFase1.jsx); a checagem de "já existe arquivo pra
// essa combinação" é feita nela mesma, sem round-trip extra ao banco.
function InputMetal({ fase, arquivos, user, profile, onArquivoEnviado }) {
  const empresas = Object.keys(AVANCO_CONFIG[fase]?.Metal?.empresas ?? {})

  const [form, setForm] = useState(FORM_VAZIO)
  const [arquivo, setArquivo] = useState(null)
  const [inputKey, setInputKey] = useState(0) // força limpar o <input type="file"> depois de enviar
  const [pendenteSubstituicao, setPendenteSubstituicao] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)

  const escopos = form.empresa ? escoposDaEmpresa(fase, 'Metal', form.empresa) : []

  function handleEmpresaChange(empresa) {
    setForm((atual) => ({ ...atual, empresa, escopo: '' }))
  }

  function handleArquivoChange(event) {
    const selecionado = event.target.files?.[0] ?? null
    setErro(null)
    if (selecionado && selecionado.size > TAMANHO_MAXIMO_BYTES) {
      setArquivo(null)
      setErro('Arquivo maior que 20 MB. Escolha um arquivo menor.')
      return
    }
    setArquivo(selecionado)
  }

  function limparFormularioParcial() {
    // Mantém Empresa e Data (é comum enviar vários escopos seguidos pra
    // mesma empresa/data) — só limpa Escopo e o arquivo selecionado.
    setForm((atual) => ({ ...atual, escopo: '' }))
    setArquivo(null)
    setInputKey((atual) => atual + 1)
  }

  async function efetivarEnvio(registroExistente) {
    setEnviando(true)
    setErro(null)
    try {
      const registro = await enviarArquivoAvanco({
        fase,
        disciplina: 'Metal',
        empresa: form.empresa,
        escopo: form.escopo,
        dataReferencia: form.dataReferencia,
        arquivo,
        registroExistente,
        user,
        profile,
      })
      onArquivoEnviado(registro)
      setSucesso(`Arquivo enviado para ${form.empresa} — ${form.escopo} (${formatarDataBR(form.dataReferencia)}).`)
      limparFormularioParcial()
    } catch (err) {
      setErro(err.message)
    } finally {
      setEnviando(false)
      setPendenteSubstituicao(null)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSucesso(null)
    setErro(null)

    if (!form.empresa || !form.escopo || !form.dataReferencia) {
      setErro('Preencha empresa, escopo e data antes de enviar.')
      return
    }
    if (!arquivo) {
      setErro('Selecione um arquivo para enviar.')
      return
    }

    const existente = arquivos.find(
      (item) =>
        item.disciplina === 'Metal' &&
        item.empresa === form.empresa &&
        item.escopo === form.escopo &&
        item.data_referencia === form.dataReferencia,
    )

    if (existente) {
      setPendenteSubstituicao({ empresa: form.empresa, escopo: form.escopo, dataReferencia: form.dataReferencia, existente })
      return
    }

    efetivarEnvio(null)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={form.empresa}
            onChange={(event) => handleEmpresaChange(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
          >
            <option value="">Selecione a empresa</option>
            {empresas.map((empresa) => (
              <option key={empresa} value={empresa}>
                {empresa}
              </option>
            ))}
          </select>

          <select
            value={form.escopo}
            onChange={(event) => setForm((atual) => ({ ...atual, escopo: event.target.value }))}
            disabled={!form.empresa}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark] dark:disabled:bg-slate-800"
          >
            <option value="">{form.empresa ? 'Selecione o escopo' : 'Selecione a empresa primeiro'}</option>
            {escopos.map((escopo) => (
              <option key={escopo} value={escopo}>
                {escopo}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={form.dataReferencia}
            onChange={(event) => setForm((atual) => ({ ...atual, dataReferencia: event.target.value }))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
          />

          <input
            key={inputKey}
            type="file"
            onChange={handleArquivoChange}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-accent/90 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
        </div>

        <p className="text-xs text-gray-400 dark:text-slate-500">Qualquer tipo de arquivo, até 20 MB.</p>

        {erro && <p className="text-sm text-alert">{erro}</p>}
        {sucesso && <p className="text-sm text-success">{sucesso}</p>}

        <div>
          <button
            type="submit"
            disabled={enviando}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {enviando && <Spinner className="h-4 w-4 text-white" />}
            {enviando ? 'Enviando...' : 'Enviar arquivo'}
          </button>
        </div>
      </form>

      {pendenteSubstituicao && (
        <ConfirmarSubstituicao
          pendente={pendenteSubstituicao}
          substituindo={enviando}
          onCancelar={() => setPendenteSubstituicao(null)}
          onConfirmar={() => efetivarEnvio(pendenteSubstituicao.existente)}
        />
      )}
    </>
  )
}

/**
 * Aba "Input": um Card por disciplina, mesmo espírito visual do sub-painel
 * de fases. Só "Metal" tem formulário de verdade por trás (ver
 * AVANCO_CONFIG); as outras 3 aparecem "Em breve" — habilitar uma nova é
 * só marcar `habilitada: true` em avancoIntegradoConfig.js e trocar o
 * card correspondente aqui por um <InputXxx /> igual a este.
 */
export default function AvancoInput({ fase, arquivos, user, profile, onArquivoEnviado }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {DISCIPLINAS_AVANCO.map((disciplina) => {
        const habilitada = AVANCO_CONFIG[fase]?.[disciplina]?.habilitada ?? false
        if (!habilitada) return <DisciplinaEmBreve key={disciplina} disciplina={disciplina} />

        return (
          <Card key={disciplina} faixaCor="#7c3aed" categoria="Disciplina" titulo={disciplina} className="lg:col-span-2">
            <InputMetal fase={fase} arquivos={arquivos} user={user} profile={profile} onArquivoEnviado={onArquivoEnviado} />
          </Card>
        )
      })}
    </div>
  )
}
