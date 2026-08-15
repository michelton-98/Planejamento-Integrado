import { useState } from 'react'
import { AVANCO_CONFIG, DISCIPLINAS_AVANCO } from '../../lib/avancoIntegradoConfig'
import {
  TAMANHO_MAXIMO_BYTES,
  TAMANHO_MAXIMO_BYTES_FORTYS,
  enviarArquivoAvanco,
  enviarArquivoFortysXml,
} from '../../lib/avancoIntegradoData'
import { processarXmlFortys } from '../../lib/fortysXmlWorkerClient'
import Card from '../Card'
import Spinner from '../Spinner'
import { formatarPercentualIndicador } from './TabelaIndicadoresFortys'

function formatarDataBR(dataISO) {
  if (!dataISO) return '—'
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarTamanho(bytes) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
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

const CLASSE_CAMPO =
  'rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]'

// Formulário genérico de upload (qualquer tipo de arquivo, sem
// processamento) — usado por toda empresa com tipoInput 'generico' (hoje,
// só QUALISOLDA). `arquivos` é a lista já carregada da fase inteira (ver
// DestilariaFase1.jsx); a checagem de "já existe arquivo pra essa
// combinação" é feita nela mesma, sem round-trip extra ao banco.
function FormularioGenericoMetal({ empresa, escopos, arquivos, user, profile, onArquivoEnviado }) {
  const [escopo, setEscopo] = useState('')
  const [dataReferencia, setDataReferencia] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [inputKey, setInputKey] = useState(0) // força limpar o <input type="file"> depois de enviar
  const [pendenteSubstituicao, setPendenteSubstituicao] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)

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
    // Mantém Data (é comum enviar vários escopos seguidos pra mesma data)
    // — só limpa Escopo e o arquivo selecionado.
    setEscopo('')
    setArquivo(null)
    setInputKey((atual) => atual + 1)
  }

  async function efetivarEnvio(registroExistente) {
    setEnviando(true)
    setErro(null)
    try {
      const registro = await enviarArquivoAvanco({
        fase: 'destilaria_fase_1',
        disciplina: 'Metal',
        empresa,
        escopo,
        dataReferencia,
        arquivo,
        registroExistente,
        user,
        profile,
      })
      onArquivoEnviado(registro)
      setSucesso(`Arquivo enviado para ${empresa} — ${escopo} (${formatarDataBR(dataReferencia)}).`)
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

    if (!escopo || !dataReferencia) {
      setErro('Preencha escopo e data antes de enviar.')
      return
    }
    if (!arquivo) {
      setErro('Selecione um arquivo para enviar.')
      return
    }

    const existente = arquivos.find(
      (item) => item.disciplina === 'Metal' && item.empresa === empresa && item.escopo === escopo && item.data_referencia === dataReferencia,
    )

    if (existente) {
      setPendenteSubstituicao({ empresa, escopo, dataReferencia, existente })
      return
    }

    efetivarEnvio(null)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select value={escopo} onChange={(event) => setEscopo(event.target.value)} className={CLASSE_CAMPO}>
            <option value="">Selecione o escopo</option>
            {escopos.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dataReferencia}
            onChange={(event) => setDataReferencia(event.target.value)}
            className={CLASSE_CAMPO}
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

// Formulário da FORTYS: só aceita .xml do MS Project (até 150 MB),
// processado inteiramente no navegador (Web Worker, ver
// fortysXmlWorkerClient/fortysXmlParse.js) — o arquivo NUNCA é enviado ao
// Storage, só lido em memória; só o resultado da extração (avanço geral +
// 6 indicadores, de Fase I e Fase II) vira o payload de
// enviarArquivoFortysXml. Escopo é fixo (hoje só existe "Prédio (Estrutura
// Principal)"): mostrado como texto, não como seletor.
function FormularioFortysXml({ empresa, escopos, arquivos, user, profile, onArquivoEnviado }) {
  const escopo = escopos[0] ?? ''

  const [dataReferencia, setDataReferencia] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [inputKey, setInputKey] = useState(0)
  const [processando, setProcessando] = useState(false)
  const [resultadoExtracao, setResultadoExtracao] = useState(null)
  const [pendenteSubstituicao, setPendenteSubstituicao] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)

  async function processarArquivo(selecionado) {
    setProcessando(true)
    setErro(null)
    setResultadoExtracao(null)
    try {
      const resultado = await processarXmlFortys(selecionado)
      setResultadoExtracao(resultado)
    } catch (err) {
      setErro(err.message)
    } finally {
      setProcessando(false)
    }
  }

  function handleArquivoChange(event) {
    const selecionado = event.target.files?.[0] ?? null
    setErro(null)
    setSucesso(null)
    setResultadoExtracao(null)
    setArquivo(null)
    if (!selecionado) return

    if (!selecionado.name.toLowerCase().endsWith('.xml')) {
      setErro('Selecione um arquivo .xml exportado do MS Project.')
      return
    }
    if (selecionado.size > TAMANHO_MAXIMO_BYTES_FORTYS) {
      setErro('Arquivo maior que 150 MB. Escolha um arquivo menor.')
      return
    }

    setArquivo(selecionado)
    processarArquivo(selecionado)
  }

  function limparFormularioParcial() {
    setArquivo(null)
    setResultadoExtracao(null)
    setInputKey((atual) => atual + 1)
  }

  async function efetivarEnvio() {
    setEnviando(true)
    setErro(null)
    try {
      const registros = await enviarArquivoFortysXml({
        escopo,
        dataReferencia,
        arquivo,
        resultadoExtracao,
        user,
        profile,
      })
      onArquivoEnviado(registros.fase1)
      setSucesso(`Cronograma enviado para ${empresa} — ${escopo} (${formatarDataBR(dataReferencia)}).`)
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

    if (!dataReferencia) {
      setErro('Preencha a data antes de enviar.')
      return
    }
    if (!arquivo || !resultadoExtracao) {
      setErro('Selecione um arquivo .xml válido e aguarde a leitura do cronograma.')
      return
    }

    // Checagem local (só enxerga registros da Fase I, ver arquivos em
    // DestilariaFase1.jsx) — só pra decidir se mostra o aviso; a checagem
    // de verdade (Fase I + Fase II) acontece dentro de
    // enviarArquivoFortysXml, direto no banco.
    const existente = arquivos.find(
      (item) => item.disciplina === 'Metal' && item.empresa === empresa && item.escopo === escopo && item.data_referencia === dataReferencia,
    )

    if (existente) {
      setPendenteSubstituicao({ empresa, escopo, dataReferencia, existente })
      return
    }

    efetivarEnvio()
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Escopo: <span className="font-medium text-navy dark:text-slate-100">{escopo}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            type="date"
            value={dataReferencia}
            onChange={(event) => setDataReferencia(event.target.value)}
            className={CLASSE_CAMPO}
          />

          <input
            key={inputKey}
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={handleArquivoChange}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-accent/90 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
        </div>

        <p className="text-xs text-gray-400 dark:text-slate-500">
          Somente arquivo .xml exportado do MS Project, até 150 MB.
        </p>

        {arquivo && (
          <div className="rounded-lg border border-dashed border-gray-300 p-3 text-sm dark:border-slate-600">
            <p className="font-medium text-navy dark:text-slate-100">
              {arquivo.name} <span className="text-xs text-gray-400 dark:text-slate-500">({formatarTamanho(arquivo.size)})</span>
            </p>

            {processando && (
              <p className="mt-2 flex items-center gap-2 text-gray-500 dark:text-slate-400">
                <Spinner className="h-3.5 w-3.5" /> Lendo cronograma...
              </p>
            )}

            {resultadoExtracao && !processando && (
              <div className="mt-2 flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300">
                <p>
                  <span className="font-medium text-navy dark:text-slate-100">Destilaria Fase I:</span>{' '}
                  {formatarPercentualIndicador(resultadoExtracao.fase1.percentualPrevistoGeral)} previsto ×{' '}
                  {formatarPercentualIndicador(resultadoExtracao.fase1.percentualExecutadoGeral)} executado ·{' '}
                  {resultadoExtracao.fase1.indicadores.length}/6 indicadores encontrados
                </p>
                <p>
                  <span className="font-medium text-navy dark:text-slate-100">Destilaria Fase II:</span>{' '}
                  {resultadoExtracao.fase2.encontrada
                    ? `${formatarPercentualIndicador(resultadoExtracao.fase2.percentualPrevistoGeral)} previsto × ${formatarPercentualIndicador(resultadoExtracao.fase2.percentualExecutadoGeral)} executado · ${resultadoExtracao.fase2.indicadores.length}/6 indicadores encontrados`
                    : 'seção não encontrada neste arquivo (não bloqueia o envio)'}
                </p>
              </div>
            )}
          </div>
        )}

        {erro && <p className="text-sm text-alert">{erro}</p>}
        {sucesso && <p className="text-sm text-success">{sucesso}</p>}

        <div>
          <button
            type="submit"
            disabled={enviando || processando || !resultadoExtracao}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {enviando && <Spinner className="h-4 w-4 text-white" />}
            {enviando ? 'Enviando...' : 'Enviar cronograma'}
          </button>
        </div>
      </form>

      {pendenteSubstituicao && (
        <ConfirmarSubstituicao
          pendente={pendenteSubstituicao}
          substituindo={enviando}
          onCancelar={() => setPendenteSubstituicao(null)}
          onConfirmar={efetivarEnvio}
        />
      )}
    </>
  )
}

// Seletor de Empresa + formulário certo pro tipo de input dela (ver
// AVANCO_CONFIG). `key={empresa}` nos formulários reseta todo o estado
// interno (campos, arquivo, resultado da extração) sozinho ao trocar de
// empresa, sem precisar de lógica manual de limpeza.
function InputMetal({ fase, arquivos, user, profile, onArquivoEnviado }) {
  const empresasConfig = AVANCO_CONFIG[fase]?.Metal?.empresas ?? {}
  const empresas = Object.keys(empresasConfig)
  const [empresa, setEmpresa] = useState('')
  const configEmpresa = empresa ? empresasConfig[empresa] : null

  return (
    <div className="flex flex-col gap-4">
      <select value={empresa} onChange={(event) => setEmpresa(event.target.value)} className={`${CLASSE_CAMPO} w-full max-w-xs`}>
        <option value="">Selecione a empresa</option>
        {empresas.map((nome) => (
          <option key={nome} value={nome}>
            {nome}
          </option>
        ))}
      </select>

      {configEmpresa?.tipoInput === 'xml_ms_project' ? (
        <FormularioFortysXml
          key={empresa}
          empresa={empresa}
          escopos={configEmpresa.escopos}
          arquivos={arquivos}
          user={user}
          profile={profile}
          onArquivoEnviado={onArquivoEnviado}
        />
      ) : (
        configEmpresa && (
          <FormularioGenericoMetal
            key={empresa}
            empresa={empresa}
            escopos={configEmpresa.escopos}
            arquivos={arquivos}
            user={user}
            profile={profile}
            onArquivoEnviado={onArquivoEnviado}
          />
        )
      )}
    </div>
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
