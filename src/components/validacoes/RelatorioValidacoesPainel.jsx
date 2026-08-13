import { useEffect, useMemo, useState } from 'react'
import {
  computeValidacoesMatrizPeriodo,
  computeValidacoesStatsSemana,
  ehQuartaFeira,
  fimMaximoPeriodoMensal,
  listarDetalheValidacaoSemana,
  quartaFeiraMaisRecente,
  quartasNoIntervalo,
  resumoMatrizPeriodo,
} from '../../lib/validacoesData'
import { gerarRelatorioValidacoesMensalPdf, gerarRelatorioValidacoesSemanalPdf } from '../../lib/pdfReportValidacoes'
import Spinner from '../Spinner'
import ToggleModo from './ToggleModo'

// Âncora só pra alinhar o `step="7"` dos date pickers do modo Mensal em
// quartas-feiras — 2020-01-01 é, de fato, uma quarta-feira. Longe no
// passado o bastante pra nunca funcionar como limite real (ver `min` dos
// inputs abaixo); é só a base de cálculo do step nativo do <input
// type="date">, que os navegadores usam pra desabilitar no calendário
// qualquer dia que não caia exatamente a cada 7 dias a partir dela.
const ANCORA_QUARTA = '2020-01-01'

const CAMPO_DATA_CLASSE =
  'rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400'

/**
 * Slide-over "Emitir Relatório" da aba Data_Base do Controle de Validações:
 * alterna Semanal/Mensal (mesmo ToggleModo do Dashboard), coleta a(s)
 * data(s) e gera o PDF correspondente (pdfReportValidacoes.js) a partir dos
 * mesmos `escopos`/`semanaisPorEscopo` já carregados pela página — sem
 * refetch próprio.
 */
export default function RelatorioValidacoesPainel({ escopos, semanaisPorEscopo, aberto, onFechar }) {
  const [modo, setModo] = useState('semanal')
  const [dataReferencia, setDataReferencia] = useState(() => quartaFeiraMaisRecente())
  const [inicioPeriodo, setInicioPeriodo] = useState('')
  const [fimPeriodo, setFimPeriodo] = useState('')
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!aberto) return
    function aoTeclar(event) {
      if (event.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto, onFechar])

  const fimMaximo = inicioPeriodo && ehQuartaFeira(inicioPeriodo) ? fimMaximoPeriodoMensal(inicioPeriodo) : null

  function handleAlterarInicio(valor) {
    setErro(null)
    setInicioPeriodo(valor)
    // Se a nova data de início invalida o fim já escolhido (fora da janela
    // de até 5 quartas-feiras, ou anterior ao novo início), reseta o fim —
    // evita ficar com um período inconsistente na tela.
    if (fimPeriodo) {
      const novoMaximo = valor && ehQuartaFeira(valor) ? fimMaximoPeriodoMensal(valor) : null
      const aindaValido = novoMaximo && fimPeriodo >= valor && fimPeriodo <= novoMaximo
      if (!aindaValido) setFimPeriodo('')
    }
  }

  const inicioValido = Boolean(inicioPeriodo) && ehQuartaFeira(inicioPeriodo)
  const fimValido =
    Boolean(fimPeriodo) &&
    ehQuartaFeira(fimPeriodo) &&
    inicioValido &&
    fimPeriodo >= inicioPeriodo &&
    fimPeriodo <= fimMaximo

  const podeEmitir = modo === 'semanal' ? Boolean(dataReferencia) : inicioValido && fimValido

  const quartasPreview = useMemo(
    () => (fimValido ? quartasNoIntervalo(inicioPeriodo, fimPeriodo) : []),
    [fimValido, inicioPeriodo, fimPeriodo],
  )

  async function handleEmitir() {
    if (!podeEmitir || gerando) return
    setGerando(true)
    setErro(null)
    try {
      if (modo === 'semanal') {
        const stats = computeValidacoesStatsSemana(escopos, semanaisPorEscopo, dataReferencia)
        const detalhes = listarDetalheValidacaoSemana(escopos, semanaisPorEscopo, dataReferencia)
        await gerarRelatorioValidacoesSemanalPdf({ dataReferencia, stats, detalhes })
      } else {
        const quartas = quartasNoIntervalo(inicioPeriodo, fimPeriodo)
        const { linhas } = computeValidacoesMatrizPeriodo(escopos, semanaisPorEscopo, quartas)
        const resumo = resumoMatrizPeriodo(linhas)
        await gerarRelatorioValidacoesMensalPdf({ inicioPeriodo, fimPeriodo, quartas, linhas, resumo })
      }
    } catch (err) {
      setErro(err.message || 'Não foi possível gerar o relatório.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className={`fixed inset-0 z-50 ${aberto ? '' : 'pointer-events-none'}`} aria-hidden={!aberto}>
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          aberto ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onFechar}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Emitir relatório de validações"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl transition-transform duration-300 ${
          aberto ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-navy">Emitir Relatório</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
          <ToggleModo modo={modo} onChange={setModo} />

          {modo === 'semanal' ? (
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Data de referência
              <input
                type="date"
                value={dataReferencia}
                onChange={(event) => setDataReferencia(event.target.value)}
                className={CAMPO_DATA_CLASSE}
              />
            </label>
          ) : (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Início do período
                <input
                  type="date"
                  min={ANCORA_QUARTA}
                  step={7}
                  value={inicioPeriodo}
                  onChange={(event) => handleAlterarInicio(event.target.value)}
                  className={CAMPO_DATA_CLASSE}
                />
                {inicioPeriodo && !inicioValido && (
                  <span className="text-xs text-alert">Selecione uma quarta-feira.</span>
                )}
              </label>

              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Fim do período
                <input
                  type="date"
                  min={inicioValido ? inicioPeriodo : ANCORA_QUARTA}
                  max={fimMaximo ?? undefined}
                  step={7}
                  value={fimPeriodo}
                  disabled={!inicioValido}
                  onChange={(event) => {
                    setErro(null)
                    setFimPeriodo(event.target.value)
                  }}
                  className={CAMPO_DATA_CLASSE}
                />
                {!inicioValido && <span className="text-xs text-gray-400">Escolha primeiro o início do período.</span>}
                {inicioValido && fimPeriodo && !fimValido && (
                  <span className="text-xs text-alert">
                    Selecione uma quarta-feira entre {inicioPeriodo.split('-').reverse().join('/')} e{' '}
                    {fimMaximo?.split('-').reverse().join('/')} (máximo de 5 semanas).
                  </span>
                )}
              </label>

              {fimValido && (
                <p className="text-xs text-gray-400">
                  {quartasPreview.length} quarta{quartasPreview.length === 1 ? '' : 's'}-feira
                  {quartasPreview.length === 1 ? '' : 's'} no período selecionado.
                </p>
              )}
            </div>
          )}

          {erro && <p className="text-sm text-alert">{erro}</p>}

          <button
            type="button"
            onClick={handleEmitir}
            disabled={!podeEmitir || gerando}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {gerando && <Spinner className="h-4 w-4 text-white" />}
            {gerando ? 'Gerando PDF...' : 'Emitir Relatório'}
          </button>
        </div>
      </div>
    </div>
  )
}
