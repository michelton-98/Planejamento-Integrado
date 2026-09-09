import { useEffect, useMemo, useState } from 'react'
import { ESCOPO_TIPO_QUALISOLDA, buscarEmpresa, listarEmpresasDaFase } from '../../lib/avancoIntegradoConfig'
import { baixarArquivoAvanco, corrigirDataArquivo } from '../../lib/avancoIntegradoData'
import { somarPesos } from '../../lib/qualisoldaAgrupamento'
import Card from '../Card'
import Spinner from '../Spinner'
import { ResumoAgrupadoEstatico, SeletorAgrupar } from './ResumoAgrupado'
import TabelaIndicadoresFortys, { formatarPercentualIndicador } from './TabelaIndicadoresFortys'
import TabelaItensQualisolda, { TabelaItensEquipamento } from './TabelaItensQualisolda'

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

const CLASSE_CAMPO =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]'

/**
 * Modal "Editar data" (botão no card de escopo/arquivo) — UPDATE simples
 * em avanco_arquivos.data_referencia (ver corrigirDataArquivo), bloqueado
 * com mensagem clara se já existir outro registro pra mesma Empresa+Escopo
 * na data nova. Os itens filhos continuam vinculados pelo mesmo
 * arquivo_id, não precisam de nada aqui.
 */
function EditarDataModal({ arquivo, arquivosExistentes, onSalvo, onCancelar }) {
  const [novaData, setNovaData] = useState(arquivo.data_referencia)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  async function handleSalvar() {
    if (!novaData) {
      setErro('Escolha uma data.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      const registro = await corrigirDataArquivo({ arquivo, novaData, arquivosExistentes })
      onSalvo(registro)
    } catch (err) {
      setErro(err.message)
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={salvando ? undefined : onCancelar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar data de referência"
        className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-800"
      >
        <h3 className="mb-1 text-base font-semibold text-navy dark:text-slate-100">Editar data de referência</h3>
        <p className="mb-3 text-sm text-gray-500 dark:text-slate-400">
          {arquivo.empresa} — {arquivo.escopo}
        </p>

        <input type="date" value={novaData} onChange={(event) => setNovaData(event.target.value)} className={CLASSE_CAMPO} />

        {erro && <p className="mt-2 text-sm text-alert">{erro}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={salvando}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {salvando && <Spinner className="h-3.5 w-3.5 text-white" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function BotaoEditarData({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="text-xs font-medium text-accent hover:underline">
      Editar data
    </button>
  )
}

const CLASSE_SUBABA = (ativa) =>
  `-mb-px border-b-2 px-3 py-1.5 text-xs font-medium transition-colors ${
    ativa
      ? 'border-accent text-accent'
      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-navy dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100'
  }`

/**
 * Card do escopo "Interligação de Carbono" (QUALISOLDA) — sempre 1 tabela
 * só (isométricos + Suportes), sem subabas (Carbono nunca tem
 * equipamentos).
 */
function CardCarbono({ arquivo, itens, onEditarData }) {
  return (
    <Card
      faixaCor="#7c3aed"
      categoria="Interligação de Carbono"
      titulo={`Isométricos + Suportes — % Avanço geral: ${formatarPercentualIndicador(arquivo.percentual_executado_geral)}`}
      acoes={<BotaoEditarData onClick={() => onEditarData(arquivo)} />}
    >
      <TabelaItensQualisolda itens={itens} />
    </Card>
  )
}

/**
 * Card do escopo "Interligação de Inox e Equipamentos" (QUALISOLDA) — 2
 * subabas: "Isométricos + Suportes" (igual ao card do Carbono) e
 * "Equipamentos" (só existe/aparece quando há itens em
 * avanco_itens_equipamento pra esse arquivo — na prática, sempre que o
 * escopo é este), com 2 tabelas separadas (Equipamentos/Torres), cada uma
 * com seu próprio % de avanço (peso executado ÷ peso total DAQUELE
 * subconjunto).
 */
function CardInox({ arquivo, itensTubulacao, itensEquipamento, onEditarData }) {
  const [subaba, setSubaba] = useState('itens')
  const temEquipamentos = itensEquipamento.length > 0

  const equipamentos = useMemo(() => itensEquipamento.filter((item) => item.classificacao === 'EQUIPAMENTO'), [itensEquipamento])
  const torres = useMemo(() => itensEquipamento.filter((item) => item.classificacao === 'TORRE'), [itensEquipamento])
  const resumoEquipamentos = useMemo(() => somarPesos(equipamentos), [equipamentos])
  const resumoTorres = useMemo(() => somarPesos(torres), [torres])

  const subabaAtiva = temEquipamentos ? subaba : 'itens'

  return (
    <Card
      faixaCor="#7c3aed"
      categoria="Interligação de Inox e Equipamentos"
      titulo={
        temEquipamentos
          ? `Tub.+Suportes: ${formatarPercentualIndicador(arquivo.percentual_executado_geral)} · Equipamentos: ${formatarPercentualIndicador(arquivo.percentual_equipamentos_geral)}`
          : `Tubulação + Suportes — % Avanço geral: ${formatarPercentualIndicador(arquivo.percentual_executado_geral)}`
      }
      acoes={<BotaoEditarData onClick={() => onEditarData(arquivo)} />}
    >
      {temEquipamentos && (
        <div className="mb-4 flex gap-2 border-b border-gray-200 dark:border-slate-700">
          <button type="button" onClick={() => setSubaba('itens')} className={CLASSE_SUBABA(subabaAtiva === 'itens')}>
            Isométricos + Suportes
          </button>
          <button type="button" onClick={() => setSubaba('equipamentos')} className={CLASSE_SUBABA(subabaAtiva === 'equipamentos')}>
            Equipamentos
          </button>
        </div>
      )}

      {subabaAtiva === 'itens' ? (
        <TabelaItensQualisolda itens={itensTubulacao} />
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-sm font-medium text-navy dark:text-slate-100">
              Equipamentos — % Avanço: {formatarPercentualIndicador(resumoEquipamentos.percentual)}
            </p>
            <TabelaItensEquipamento itens={equipamentos} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-navy dark:text-slate-100">
              Torres — % Avanço: {formatarPercentualIndicador(resumoTorres.percentual)}
            </p>
            <TabelaItensEquipamento itens={torres} />
          </div>
        </div>
      )}
    </Card>
  )
}

/**
 * Aba "Data_Base": leitura dos arquivos de qualquer empresa/escopo, com
 * edição da data de referência (ver EditarDataModal/BotaoEditarData) —
 * disponível pra QUALQUER Empresa (QUALISOLDA nos cards Carbono/Inox, e
 * FORTYS/genérica na tabela de escopos abaixo), mesma lógica de bloqueio de
 * duplicidade e mesma policy de UPDATE (migration 0016, aberta a todo
 * aprovado — nada específico de QUALISOLDA no banco). A QUALISOLDA também
 * ganha o resumo "Agrupar" (ver ResumoAgrupado.jsx); cadastro/substituição
 * de arquivo continua só na aba Input (ver AvancoInput.jsx); esta aba nunca
 * mexe nos itens filhos.
 */
export default function AvancoDataBase({
  fase,
  arquivos,
  indicadoresPorArquivo,
  itensTubulacaoPorArquivo,
  itensEquipamentoPorArquivo,
  onArquivoAtualizado,
}) {
  const empresas = useMemo(() => listarEmpresasDaFase(fase), [fase])
  const [empresaSelecionada, setEmpresaSelecionada] = useState(empresas[0]?.empresa ?? '')
  const [dataSelecionada, setDataSelecionada] = useState('')
  const [baixandoEscopo, setBaixandoEscopo] = useState(null)
  const [erroDownload, setErroDownload] = useState(null)
  const [agrupar, setAgrupar] = useState('')
  const [edicaoData, setEdicaoData] = useState(null)

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

  // QUALISOLDA (tipoInput 'xlsx_qualisolda'): cada escopo é seu próprio
  // arquivo/planilha na mesma data — busca os 2 (Carbono/Inox)
  // separadamente, cada um com seus próprios itens (ver migration 0024).
  const ehQualisoldaXlsx = tipoInput === 'xlsx_qualisolda'
  const arquivoCarbono = ehQualisoldaXlsx
    ? (arquivosDaEmpresa.find((item) => ESCOPO_TIPO_QUALISOLDA[item.escopo] === 'carbono' && item.data_referencia === dataSelecionada) ?? null)
    : null
  const arquivoInox = ehQualisoldaXlsx
    ? (arquivosDaEmpresa.find((item) => ESCOPO_TIPO_QUALISOLDA[item.escopo] === 'inox' && item.data_referencia === dataSelecionada) ?? null)
    : null
  const itensCarbono = arquivoCarbono ? (itensTubulacaoPorArquivo.get(arquivoCarbono.id) ?? []) : []
  const itensTubulacaoInox = arquivoInox ? (itensTubulacaoPorArquivo.get(arquivoInox.id) ?? []) : []
  const itensEquipamentoInox = arquivoInox ? (itensEquipamentoPorArquivo.get(arquivoInox.id) ?? []) : []

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

  function handleDataSalva(registro) {
    setEdicaoData(null)
    onArquivoAtualizado(registro)
    // A data mudou: se a nova data for diferente da selecionada no filtro,
    // segue nela mesma (a combinação some da tela) — comportamento normal
    // de qualquer edição, sem precisar de lógica extra.
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

        {ehQualisoldaXlsx && <SeletorAgrupar value={agrupar} onChange={setAgrupar} />}
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

      {ehQualisoldaXlsx ? (
        agrupar ? (
          <ResumoAgrupadoEstatico
            opcao={agrupar}
            itensCarbono={itensCarbono}
            itensInox={itensTubulacaoInox}
            itensEquipamento={itensEquipamentoInox}
          />
        ) : (
          <>
            {!arquivoCarbono && !arquivoInox && (
              <Card faixaCor="#7c3aed" categoria={empresaSelecionada} titulo={dataSelecionada ? `Escopos em ${formatarDataBR(dataSelecionada)}` : 'Escopos'}>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {dataSelecionada ? 'Nenhum arquivo enviado nessa data.' : 'Nenhuma data com envio ainda.'}
                </p>
              </Card>
            )}

            {arquivoCarbono && <CardCarbono arquivo={arquivoCarbono} itens={itensCarbono} onEditarData={setEdicaoData} />}

            {arquivoInox && (
              <CardInox
                arquivo={arquivoInox}
                itensTubulacao={itensTubulacaoInox}
                itensEquipamento={itensEquipamentoInox}
                onEditarData={setEdicaoData}
              />
            )}
          </>
        )
      ) : (
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
                        <div className="flex items-center justify-end gap-3">
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
                          {arquivo && <BotaoEditarData onClick={() => setEdicaoData(arquivo)} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {edicaoData && (
        <EditarDataModal
          arquivo={edicaoData}
          arquivosExistentes={arquivos}
          onSalvo={handleDataSalva}
          onCancelar={() => setEdicaoData(null)}
        />
      )}
    </div>
  )
}
