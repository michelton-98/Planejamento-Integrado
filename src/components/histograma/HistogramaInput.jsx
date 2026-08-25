import { useState } from 'react'
import { enviarHistogramaEfetivo, parseHistogramaFile } from '../../lib/histogramaData'
import Card from '../Card'
import Spinner from '../Spinner'

const CLASSE_CAMPO =
  'rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark] dark:disabled:bg-slate-800 dark:disabled:text-slate-500'

function formatarDataBR(dataISO) {
  if (!dataISO) return '—'
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarNumero(valor) {
  return valor == null ? '—' : String(valor)
}

/** Pré-visualização das linhas lidas do .csv, antes de confirmar o envio — linhas com erro (Empresa/Disciplina vazia) em destaque, bloqueiam o envio. */
function PreviaArquivo({ parseResult }) {
  const totalErros = parseResult.linhas.filter((linha) => linha.erro).length

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-500 dark:text-slate-400">
        {parseResult.linhas.length} linha{parseResult.linhas.length === 1 ? '' : 's'} lida
        {parseResult.linhas.length === 1 ? '' : 's'}
        {totalErros > 0 && <span className="text-alert"> · {totalErros} com erro (corrija o arquivo e reenvie)</span>}
      </p>

      <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-gray-200 text-xs dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-700/50">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-slate-400">Empresa</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-slate-400">Disciplina</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-slate-400">Tipo MO</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-500 dark:text-slate-400">Previsto</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-500 dark:text-slate-400">Realizado</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-500 dark:text-slate-400">Projeção</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
            {parseResult.linhas.map((linha) => (
              <tr key={linha.linha} className={linha.erro ? 'bg-alert/10' : undefined}>
                <td className="px-2 py-1.5 text-navy dark:text-slate-100">
                  {linha.empresa || <span className="text-alert">{linha.erro}</span>}
                </td>
                <td className="px-2 py-1.5 text-navy dark:text-slate-100">
                  {linha.disciplina}
                  {!linha.disciplinaReconhecida && linha.disciplina && (
                    <span className="ml-1 text-[10px] uppercase text-gold">não reconhecida</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-gray-500 dark:text-slate-400">{linha.tipo_mo || '—'}</td>
                <td className="px-2 py-1.5 text-right text-navy dark:text-slate-100">{formatarNumero(linha.previsto)}</td>
                <td className="px-2 py-1.5 text-right text-navy dark:text-slate-100">{formatarNumero(linha.realizado)}</td>
                <td className="px-2 py-1.5 text-right text-navy dark:text-slate-100">{formatarNumero(linha.projecao)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Quadro de conferência: linhas já cadastradas em histograma_efetivo pra `dataVisualizacao`. */
function QuadroCadastrado({ linhas }) {
  if (linhas.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum dado cadastrado para esta data.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
        <thead className="bg-gray-50 dark:bg-slate-700/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Empresa</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Disciplina</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Tipo MO</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Previsto</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Realizado</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Projeção</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
          {linhas.map((linha) => (
            <tr key={linha.id}>
              <td className="px-3 py-2 text-navy dark:text-slate-100">{linha.empresa}</td>
              <td className="px-3 py-2 text-navy dark:text-slate-100">{linha.disciplina}</td>
              <td className="px-3 py-2 text-gray-500 dark:text-slate-400">{linha.tipo_mo || '—'}</td>
              <td className="px-3 py-2 text-right text-navy dark:text-slate-100">{formatarNumero(linha.previsto)}</td>
              <td className="px-3 py-2 text-right text-navy dark:text-slate-100">{formatarNumero(linha.realizado)}</td>
              <td className="px-3 py-2 text-right text-navy dark:text-slate-100">{formatarNumero(linha.projecao)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Aba "Input": envio de um .csv de efetivo pra uma Data de Referência
 * escolhida explicitamente (não confia cegamente na coluna "Data Ref." de
 * dentro do arquivo — só avisa se ela divergir, sem bloquear o envio) +
 * um quadro de conferência dos dados já cadastrados pra uma data à parte
 * (seletor "visualizar", independente do de envio).
 *
 * `linhasTodas` (todas as datas, já carregado pelo pai — ver Histograma.jsx)
 * é filtrado aqui em memória pra montar o quadro de conferência, sem
 * round-trip extra ao banco.
 */
export default function HistogramaInput({ linhasTodas, datasDisponiveis, user, profile, onEnviado }) {
  const [dataReferenciaEnvio, setDataReferenciaEnvio] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [inputKey, setInputKey] = useState(0)
  const [parseResult, setParseResult] = useState(null)
  const [processando, setProcessando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)

  const [dataVisualizacao, setDataVisualizacao] = useState(() => datasDisponiveis[0] ?? '')

  async function handleArquivoChange(event) {
    const selecionado = event.target.files?.[0] ?? null
    setErro(null)
    setSucesso(null)
    setParseResult(null)
    setArquivo(selecionado)
    if (!selecionado) return

    if (!selecionado.name.toLowerCase().endsWith('.csv')) {
      setErro('Selecione um arquivo .csv.')
      setArquivo(null)
      return
    }

    setProcessando(true)
    try {
      const resultado = await parseHistogramaFile(selecionado)
      setParseResult(resultado)
    } catch (err) {
      setErro(err.message)
      setArquivo(null)
    } finally {
      setProcessando(false)
    }
  }

  const totalErros = parseResult?.linhas.filter((linha) => linha.erro).length ?? 0
  const dataDivergente =
    parseResult?.dataRefMaisComum && dataReferenciaEnvio && parseResult.dataRefMaisComum !== dataReferenciaEnvio

  const podeEnviar = Boolean(arquivo && parseResult && dataReferenciaEnvio && totalErros === 0 && !processando)

  async function handleEnviar(event) {
    event.preventDefault()
    if (!podeEnviar || enviando) return

    setEnviando(true)
    setErro(null)
    setSucesso(null)
    try {
      const linhasEnviadas = await enviarHistogramaEfetivo({
        dataReferencia: dataReferenciaEnvio,
        linhas: parseResult.linhas,
        user,
        profile,
      })
      onEnviado(dataReferenciaEnvio, linhasEnviadas)
      setDataVisualizacao(dataReferenciaEnvio)
      setSucesso(`Efetivo enviado para ${formatarDataBR(dataReferenciaEnvio)} (${linhasEnviadas.length} linhas).`)
      setArquivo(null)
      setParseResult(null)
      setInputKey((atual) => atual + 1)
    } catch (err) {
      setErro(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const linhasVisualizacao = linhasTodas.filter((linha) => linha.data_referencia === dataVisualizacao)

  return (
    <div className="flex flex-col gap-5">
      <Card faixaCor="#0891b2" categoria="Envio" titulo="Enviar efetivo (.csv)">
        <form onSubmit={handleEnviar} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-slate-300">
              Data de referência
              <input
                type="date"
                value={dataReferenciaEnvio}
                onChange={(event) => setDataReferenciaEnvio(event.target.value)}
                className={CLASSE_CAMPO}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-slate-300">
              Arquivo (.csv)
              <input
                key={inputKey}
                type="file"
                accept=".csv,text/csv"
                onChange={handleArquivoChange}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-accent/90 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </label>
          </div>

          <p className="text-xs text-gray-400 dark:text-slate-500">
            Colunas esperadas: Empresa, Disciplina, Tipo MO, Previsto, Realizado, Projeção, Data Ref. Reenviar a
            mesma data substitui todo o snapshot já cadastrado para ela.
          </p>

          {processando && (
            <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
              <Spinner className="h-4 w-4" /> Lendo arquivo...
            </p>
          )}

          {dataDivergente && (
            <p className="text-sm text-gold">
              A coluna "Data Ref." do arquivo aponta para {formatarDataBR(parseResult.dataRefMaisComum)}, diferente
              da data selecionada ({formatarDataBR(dataReferenciaEnvio)}). Confira antes de confirmar — o envio usa
              a data escolhida aqui, não a do arquivo.
            </p>
          )}

          {parseResult && <PreviaArquivo parseResult={parseResult} />}

          {erro && <p className="text-sm text-alert">{erro}</p>}
          {sucesso && <p className="text-sm text-success">{sucesso}</p>}

          <div>
            <button
              type="submit"
              disabled={!podeEnviar || enviando}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando && <Spinner className="h-4 w-4 text-white" />}
              {enviando ? 'Enviando...' : 'Confirmar envio'}
            </button>
          </div>
        </form>
      </Card>

      <Card faixaCor="#0891b2" categoria="Conferência" titulo="Dados cadastrados">
        <label className="mb-4 flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
          Data de referência
          <input
            type="date"
            value={dataVisualizacao}
            onChange={(event) => setDataVisualizacao(event.target.value)}
            className={`${CLASSE_CAMPO} w-auto`}
          />
        </label>

        <QuadroCadastrado linhas={linhasVisualizacao} />
      </Card>
    </div>
  )
}
