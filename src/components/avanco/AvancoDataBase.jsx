import { useEffect, useMemo, useState } from 'react'
import { buscarEmpresa, listarEmpresasDaFase } from '../../lib/avancoIntegradoConfig'
import { baixarArquivoAvanco } from '../../lib/avancoIntegradoData'
import Card from '../Card'
import Spinner from '../Spinner'
import TabelaIndicadoresFortys, { formatarPercentualIndicador } from './TabelaIndicadoresFortys'

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

/**
 * Aba "Data_Base": só leitura — mostra o "banco de dados" de arquivos por
 * empresa/data, com botão de baixar quando existir um arquivo cadastrado
 * pro escopo. Cadastro/substituição de arquivo acontece só na aba Input
 * (ver AvancoInput.jsx); esta aba nunca escreve em avanco_arquivos.
 */
export default function AvancoDataBase({ fase, arquivos, indicadoresPorArquivo }) {
  const empresas = useMemo(() => listarEmpresasDaFase(fase), [fase])
  const [empresaSelecionada, setEmpresaSelecionada] = useState(empresas[0]?.empresa ?? '')
  const [dataSelecionada, setDataSelecionada] = useState('')
  const [baixandoEscopo, setBaixandoEscopo] = useState(null)
  const [erroDownload, setErroDownload] = useState(null)

  const arquivosDaEmpresa = useMemo(
    () => arquivos.filter((arquivo) => arquivo.empresa === empresaSelecionada),
    [arquivos, empresaSelecionada],
  )

  const datasDisponiveis = useMemo(
    () => [...new Set(arquivosDaEmpresa.map((arquivo) => arquivo.data_referencia))].sort((a, b) => (a < b ? 1 : -1)),
    [arquivosDaEmpresa],
  )

  // Ao trocar de empresa (ou quando a lista de datas dela muda), seleciona
  // a data mais recente automaticamente.
  useEffect(() => {
    setDataSelecionada((atual) => (datasDisponiveis.includes(atual) ? atual : (datasDisponiveis[0] ?? '')))
  }, [datasDisponiveis])

  const { escopos, tipoInput } = buscarEmpresa(fase, empresaSelecionada) ?? { escopos: [], tipoInput: 'generico' }

  // Só existe pra empresas de cronograma (tipoInput 'xml_ms_project', ver
  // avancoIntegradoConfig.js) — o arquivo da data selecionada, com o %
  // geral + os 6 indicadores extraídos dele (ver migration 0019).
  const arquivoCronograma =
    tipoInput === 'xml_ms_project'
      ? (arquivosDaEmpresa.find((item) => item.data_referencia === dataSelecionada) ?? null)
      : null
  const indicadoresCronograma = arquivoCronograma ? (indicadoresPorArquivo.get(arquivoCronograma.id) ?? []) : []

  const linhas = useMemo(
    () =>
      escopos.map((escopo) => ({
        escopo,
        arquivo: arquivosDaEmpresa.find(
          (item) => item.escopo === escopo && item.data_referencia === dataSelecionada,
        ),
      })),
    [escopos, arquivosDaEmpresa, dataSelecionada],
  )

  async function handleBaixar(arquivo) {
    setBaixandoEscopo(arquivo.escopo)
    setErroDownload(null)
    try {
      await baixarArquivoAvanco(arquivo)
    } catch (err) {
      setErroDownload(err.message)
    } finally {
      setBaixandoEscopo(null)
    }
  }

  if (empresas.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400">Nenhuma empresa cadastrada ainda nesta fase.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
          Empresa
          <select
            value={empresaSelecionada}
            onChange={(event) => setEmpresaSelecionada(event.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
          >
            {empresas.map(({ empresa }) => (
              <option key={empresa} value={empresa}>
                {empresa}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
          Data
          {datasDisponiveis.length === 0 ? (
            <span className="text-sm text-gray-400 dark:text-slate-500">Nenhuma data com envio ainda</span>
          ) : (
            <select
              value={dataSelecionada}
              onChange={(event) => setDataSelecionada(event.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]"
            >
              {datasDisponiveis.map((data) => (
                <option key={data} value={data}>
                  {formatarDataBR(data)}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      {erroDownload && <p className="text-sm text-alert">{erroDownload}</p>}

      {arquivoCronograma && (
        <Card faixaCor="#7c3aed" categoria={empresaSelecionada} titulo="Avanço do cronograma (MS Project)">
          <div className="mb-4 flex gap-3">
            <div className="flex-1 rounded-lg bg-gray-50 p-3 text-center dark:bg-slate-700/40">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">% Previsto</p>
              <p className="text-2xl font-semibold text-navy dark:text-slate-100">
                {formatarPercentualIndicador(arquivoCronograma.percentual_previsto_geral)}
              </p>
            </div>
            <div className="flex-1 rounded-lg bg-gray-50 p-3 text-center dark:bg-slate-700/40">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">% Executado</p>
              <p className="text-2xl font-semibold text-accent">
                {formatarPercentualIndicador(arquivoCronograma.percentual_executado_geral)}
              </p>
            </div>
          </div>
          <TabelaIndicadoresFortys indicadores={indicadoresCronograma} />
        </Card>
      )}

      <Card faixaCor="#7c3aed" categoria={empresaSelecionada} titulo={dataSelecionada ? `Escopos em ${formatarDataBR(dataSelecionada)}` : 'Escopos'}>
        {linhas.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum escopo cadastrado pra essa empresa.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Escopo</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Arquivo</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-400">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
                {linhas.map(({ escopo, arquivo }) => (
                  <tr key={escopo}>
                    <td className="px-3 py-2 text-navy dark:text-slate-100">{escopo}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          arquivo ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500'
                        }`}
                      >
                        {arquivo ? 'Enviado' : 'Não enviado'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-slate-400">
                      {arquivo ? (
                        <>
                          {arquivo.nome_arquivo}{' '}
                          <span className="text-xs text-gray-400 dark:text-slate-500">{formatarTamanho(arquivo.tamanho_bytes)}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {arquivo?.storage_path ? (
                        <button
                          type="button"
                          onClick={() => handleBaixar(arquivo)}
                          disabled={baixandoEscopo === escopo}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline disabled:opacity-50"
                        >
                          {baixandoEscopo === escopo && <Spinner className="h-3 w-3" />}
                          Baixar
                        </button>
                      ) : (
                        // Fluxo de cronograma (ver arquivoCronograma acima): não existe
                        // arquivo pra baixar — o resumo já extraído (% geral + indicadores)
                        // é o card "Avanço do cronograma" logo acima desta tabela.
                        arquivo && <span className="text-xs text-gray-400 dark:text-slate-500">Ver resumo acima</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
