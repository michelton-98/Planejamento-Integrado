import { useMemo } from 'react'
import { AVANCO_CONFIG, DISCIPLINAS_AVANCO, ESCOPO_TIPO_QUALISOLDA } from '../../lib/avancoIntegradoConfig'
import { calcularAvancoPorEmpresa } from '../../lib/avancoIntegradoData'
import Card from '../Card'
import Spinner from '../Spinner'
import GestaoVisual from './GestaoVisual'
import TabelaIndicadoresFortys, { formatarPercentualIndicador } from './TabelaIndicadoresFortys'

function formatarDataBR(dataISO) {
  if (!dataISO) return '—'
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

// Indicador "Avanço por Empresa (cobertura de envio)" — o indicador
// original da ferramenta, mantido pra toda empresa de input genérico
// (tipoInput: 'generico', ex.: QUALISOLDA). Empresas de cronograma
// (tipoInput: 'xml_ms_project', ex.: FORTYS) usam IndicadorCronogramaFortys
// no lugar deste — ver BlocoDisciplina.
function IndicadorCoberturaEnvio({ disciplina, empresa, escopos, arquivosEmpresa }) {
  const indicador = useMemo(
    () => calcularAvancoPorEmpresa(arquivosEmpresa, { [empresa]: escopos })[0],
    [arquivosEmpresa, empresa, escopos],
  )

  return (
    <Card faixaCor="#7c3aed" categoria={`${disciplina} · ${empresa}`} titulo="Avanço por Empresa (cobertura de envio)">
      <p className="mb-3 text-xs text-gray-400 dark:text-slate-500">
        % de escopos com pelo menos 1 arquivo enviado na data de referência mais recente.
      </p>
      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-xs text-gray-400 dark:text-slate-500">
            {indicador.dataReferencia
              ? `${indicador.escoposEnviados}/${indicador.totalEscopos} escopos · ref. ${formatarDataBR(indicador.dataReferencia)}`
              : 'Nenhum arquivo enviado ainda'}
          </span>
          <span className="font-semibold text-navy dark:text-slate-100">{indicador.percentual}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
          <div className="h-full rounded-full bg-[#7c3aed]" style={{ width: `${indicador.percentual}%` }} />
        </div>
      </div>
    </Card>
  )
}

// Indicador de cronograma (FORTYS): % avanço geral (previsto x executado)
// do "Prédio (Estrutura Principal)" + os 6 indicadores individuais, todos
// extraídos automaticamente do .xml na data mais recente disponível — ver
// fortysXmlParse.js / migration 0019.
function IndicadorCronogramaFortys({ disciplina, empresa, arquivosEmpresa, indicadoresPorArquivo }) {
  const arquivoRecente = useMemo(() => {
    if (arquivosEmpresa.length === 0) return null
    return arquivosEmpresa.reduce((maisRecente, atual) =>
      atual.data_referencia > maisRecente.data_referencia ? atual : maisRecente,
    )
  }, [arquivosEmpresa])

  if (!arquivoRecente) {
    return (
      <Card faixaCor="#7c3aed" categoria={`${disciplina} · ${empresa}`} titulo="Avanço do cronograma">
        <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum arquivo enviado ainda.</p>
      </Card>
    )
  }

  const indicadores = indicadoresPorArquivo.get(arquivoRecente.id) ?? []

  return (
    <Card faixaCor="#7c3aed" categoria={`${disciplina} · ${empresa}`} titulo="Avanço do cronograma (MS Project)">
      <p className="mb-3 text-xs text-gray-400 dark:text-slate-500">
        Extraído do cronograma de {formatarDataBR(arquivoRecente.data_referencia)} · {arquivoRecente.escopo}
      </p>

      <div className="mb-4 flex gap-3">
        <div className="flex-1 rounded-lg bg-gray-50 p-3 text-center dark:bg-slate-700/40">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">% Previsto</p>
          <p className="text-2xl font-semibold text-navy dark:text-slate-100">
            {formatarPercentualIndicador(arquivoRecente.percentual_previsto_geral)}
          </p>
        </div>
        <div className="flex-1 rounded-lg bg-gray-50 p-3 text-center dark:bg-slate-700/40">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">% Executado</p>
          <p className="text-2xl font-semibold text-accent">
            {formatarPercentualIndicador(arquivoRecente.percentual_executado_geral)}
          </p>
        </div>
      </div>

      <TabelaIndicadoresFortys indicadores={indicadores} />
    </Card>
  )
}

// Indicador da QUALISOLDA (tipoInput 'xlsx_qualisolda'): só os agregados
// dos 2 escopos (Dashboard não lista item a item, ver PARTE 3 do prompt
// original) — % avanço geral de Carbono, % avanço geral de Inox (tubulação
// + suportes) e % avanço de Equipamentos à parte, cada um lido do arquivo
// mais recente DAQUELE escopo (Carbono e Inox chegam em arquivos/datas
// separados, ver ESCOPO_TIPO_QUALISOLDA).
function StatTile({ rotulo, valor, destaque }) {
  return (
    <div className="flex-1 rounded-lg bg-gray-50 p-3 text-center dark:bg-slate-700/40">
      <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">{rotulo}</p>
      <p className={`text-2xl font-semibold ${destaque ? 'text-accent' : 'text-navy dark:text-slate-100'}`}>{valor}</p>
    </div>
  )
}

function maisRecente(lista) {
  if (lista.length === 0) return null
  return lista.reduce((atual, item) => (item.data_referencia > atual.data_referencia ? item : atual))
}

function IndicadorQualisoldaXlsx({ disciplina, empresa, arquivosEmpresa }) {
  const arquivoCarbono = useMemo(
    () => maisRecente(arquivosEmpresa.filter((item) => ESCOPO_TIPO_QUALISOLDA[item.escopo] === 'carbono')),
    [arquivosEmpresa],
  )
  const arquivoInox = useMemo(
    () => maisRecente(arquivosEmpresa.filter((item) => ESCOPO_TIPO_QUALISOLDA[item.escopo] === 'inox')),
    [arquivosEmpresa],
  )

  if (!arquivoCarbono && !arquivoInox) {
    return (
      <Card faixaCor="#7c3aed" categoria={`${disciplina} · ${empresa}`} titulo="Avanço por Escopo">
        <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum arquivo enviado ainda.</p>
      </Card>
    )
  }

  return (
    <Card faixaCor="#7c3aed" categoria={`${disciplina} · ${empresa}`} titulo="Avanço por Escopo">
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-slate-400">
            Interligação de Carbono
            {arquivoCarbono && <> · ref. {formatarDataBR(arquivoCarbono.data_referencia)}</>}
          </p>
          <div className="flex gap-3">
            <StatTile
              rotulo="% Avanço geral"
              valor={arquivoCarbono ? formatarPercentualIndicador(arquivoCarbono.percentual_executado_geral) : '—'}
              destaque
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-slate-400">
            Interligação de Inox e Equipamentos
            {arquivoInox && <> · ref. {formatarDataBR(arquivoInox.data_referencia)}</>}
          </p>
          <div className="flex gap-3">
            <StatTile
              rotulo="% Avanço geral (Tub. + Suportes)"
              valor={arquivoInox ? formatarPercentualIndicador(arquivoInox.percentual_executado_geral) : '—'}
              destaque
            />
            <StatTile
              rotulo="% Avanço Equipamentos"
              valor={arquivoInox ? formatarPercentualIndicador(arquivoInox.percentual_equipamentos_geral) : '—'}
              destaque
            />
          </div>
        </div>
      </div>
    </Card>
  )
}

function BlocoDisciplina({ fase, disciplina, arquivos, indicadoresPorArquivo }) {
  const arquivosDisciplina = useMemo(
    () => arquivos.filter((arquivo) => arquivo.disciplina === disciplina),
    [arquivos, disciplina],
  )
  const empresasConfig = AVANCO_CONFIG[fase]?.[disciplina]?.empresas ?? {}

  if (arquivosDisciplina.length === 0) {
    return (
      <Card faixaCor="#7c3aed" categoria={disciplina} titulo="Avanço por Empresa">
        <p className="text-sm text-gray-500 dark:text-slate-400">Ainda sem dados cadastrados nessa disciplina.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(empresasConfig).map(([empresa, configEmpresa]) => {
        const arquivosEmpresa = arquivosDisciplina.filter((arquivo) => arquivo.empresa === empresa)

        return configEmpresa.tipoInput === 'xml_ms_project' ? (
          <IndicadorCronogramaFortys
            key={empresa}
            disciplina={disciplina}
            empresa={empresa}
            arquivosEmpresa={arquivosEmpresa}
            indicadoresPorArquivo={indicadoresPorArquivo}
          />
        ) : configEmpresa.tipoInput === 'xlsx_qualisolda' ? (
          <IndicadorQualisoldaXlsx key={empresa} disciplina={disciplina} empresa={empresa} arquivosEmpresa={arquivosEmpresa} />
        ) : (
          <IndicadorCoberturaEnvio
            key={empresa}
            disciplina={disciplina}
            empresa={empresa}
            escopos={configEmpresa.escopos}
            arquivosEmpresa={arquivosEmpresa}
          />
        )
      })}
    </div>
  )
}

/**
 * Aba "Dashboard": checklist de disciplinas (persistido no perfil do
 * usuário, ver DestilariaFase1.jsx) + um bloco de indicadores por
 * disciplina marcada — um Card por empresa dentro do bloco, cada um com o
 * indicador certo pro tipo de input daquela empresa (ver BlocoDisciplina).
 */
export default function AvancoDashboard({
  fase,
  arquivos,
  indicadoresPorArquivo,
  itensTubulacaoPorArquivo,
  itensEquipamentoPorArquivo,
  disciplinasSelecionadas,
  onAlterarDisciplinas,
  salvando,
}) {
  const todasMarcadas = disciplinasSelecionadas.length === DISCIPLINAS_AVANCO.length

  function alternarTodas() {
    onAlterarDisciplinas(todasMarcadas ? [] : [...DISCIPLINAS_AVANCO])
  }

  function alternarDisciplina(disciplina) {
    const novaLista = disciplinasSelecionadas.includes(disciplina)
      ? disciplinasSelecionadas.filter((item) => item !== disciplina)
      : [...disciplinasSelecionadas, disciplina]
    onAlterarDisciplinas(novaLista)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <label className="flex items-center gap-2 text-sm font-medium text-navy dark:text-slate-100">
          <input
            type="checkbox"
            checked={todasMarcadas}
            onChange={alternarTodas}
            disabled={salvando}
            className="rounded border-gray-300 text-accent focus:ring-accent dark:border-slate-500 dark:bg-slate-700"
          />
          Todas as Disciplinas
        </label>
        <div className="h-4 w-px bg-gray-200 dark:bg-slate-700" />
        {DISCIPLINAS_AVANCO.map((disciplina) => (
          <label key={disciplina} className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={disciplinasSelecionadas.includes(disciplina)}
              onChange={() => alternarDisciplina(disciplina)}
              disabled={salvando}
              className="rounded border-gray-300 text-accent focus:ring-accent dark:border-slate-500 dark:bg-slate-700"
            />
            {disciplina}
          </label>
        ))}
        {salvando && <Spinner className="h-3.5 w-3.5 text-accent" />}
      </div>

      {disciplinasSelecionadas.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Nenhuma disciplina selecionada.</p>
      ) : (
        DISCIPLINAS_AVANCO.filter((disciplina) => disciplinasSelecionadas.includes(disciplina)).map((disciplina) => (
          <BlocoDisciplina
            key={disciplina}
            fase={fase}
            disciplina={disciplina}
            arquivos={arquivos}
            indicadoresPorArquivo={indicadoresPorArquivo}
          />
        ))
      )}

      {/* Painel "Gestão Visual": só em Destilaria Fase I (ver prompt original) — as demais fases continuam só com os indicadores por disciplina acima. */}
      {fase === 'destilaria_fase_1' && (
        <GestaoVisual
          arquivos={arquivos}
          indicadoresPorArquivo={indicadoresPorArquivo}
          itensTubulacaoPorArquivo={itensTubulacaoPorArquivo}
          itensEquipamentoPorArquivo={itensEquipamentoPorArquivo}
        />
      )}
    </div>
  )
}
