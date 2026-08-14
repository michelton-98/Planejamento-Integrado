import { useMemo } from 'react'
import { AVANCO_CONFIG, DISCIPLINAS_AVANCO } from '../../lib/avancoIntegradoConfig'
import { calcularAvancoPorEmpresa } from '../../lib/avancoIntegradoData'
import Card from '../Card'
import Spinner from '../Spinner'

function formatarDataBR(dataISO) {
  if (!dataISO) return '—'
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

// Indicador "Avanço por Empresa" de uma disciplina — primeiro indicador da
// ferramenta (ver comentário no componente pai). Estrutura pensada pra
// caber novos indicadores ao lado deste, um Card por indicador, todos
// dentro do mesmo bloco por disciplina.
function IndicadorAvancoPorEmpresa({ disciplina, arquivosDisciplina, empresas }) {
  const indicadores = useMemo(
    () => calcularAvancoPorEmpresa(arquivosDisciplina, empresas),
    [arquivosDisciplina, empresas],
  )

  return (
    <Card faixaCor="#7c3aed" categoria={disciplina} titulo="Avanço por Empresa (cobertura de envio)">
      <p className="mb-3 text-xs text-gray-400 dark:text-slate-500">
        % de escopos com pelo menos 1 arquivo enviado na data de referência mais recente de cada empresa.
      </p>
      <div className="flex flex-col gap-3">
        {indicadores.map((indicador) => (
          <div key={indicador.empresa}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-navy dark:text-slate-100">{indicador.empresa}</span>
              <span className="text-xs text-gray-400 dark:text-slate-500">
                {indicador.dataReferencia
                  ? `${indicador.escoposEnviados}/${indicador.totalEscopos} escopos · ref. ${formatarDataBR(indicador.dataReferencia)}`
                  : 'Nenhum arquivo enviado ainda'}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-[#7c3aed]"
                style={{ width: `${indicador.percentual}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function BlocoDisciplina({ fase, disciplina, arquivos }) {
  const arquivosDisciplina = useMemo(
    () => arquivos.filter((arquivo) => arquivo.disciplina === disciplina),
    [arquivos, disciplina],
  )
  const empresas = AVANCO_CONFIG[fase]?.[disciplina]?.empresas ?? {}

  if (arquivosDisciplina.length === 0) {
    return (
      <Card faixaCor="#7c3aed" categoria={disciplina} titulo="Avanço por Empresa">
        <p className="text-sm text-gray-500 dark:text-slate-400">Ainda sem dados cadastrados nessa disciplina.</p>
      </Card>
    )
  }

  return <IndicadorAvancoPorEmpresa disciplina={disciplina} arquivosDisciplina={arquivosDisciplina} empresas={empresas} />
}

/**
 * Aba "Dashboard": checklist de disciplinas (persistido no perfil do
 * usuário, ver DestilariaFase1.jsx) + um Card de indicador por disciplina
 * marcada. Só o indicador "Avanço por Empresa" existe por enquanto — a
 * estrutura (BlocoDisciplina por disciplina, um Card por indicador dentro
 * dele) já fica pronta pra receber os próximos indicadores.
 */
export default function AvancoDashboard({ fase, arquivos, disciplinasSelecionadas, onAlterarDisciplinas, salvando }) {
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
          <BlocoDisciplina key={disciplina} fase={fase} disciplina={disciplina} arquivos={arquivos} />
        ))
      )}
    </div>
  )
}
