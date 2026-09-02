import { useMemo, useState } from 'react'
import { ESCOPO_TIPO_QUALISOLDA, buscarEmpresa, listarEmpresasDaFase } from '../../lib/avancoIntegradoConfig'
import { compararItens } from '../../lib/qualisoldaAgrupamento'
import Card from '../Card'
import { ResumoAgrupadoComparacao, SeletorAgrupar } from './ResumoAgrupado'
import TabelaComparacaoAtualizacao from './TabelaComparacaoAtualizacao'

function formatarDataBR(dataISO) {
  if (!dataISO) return '—'
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

const CLASSE_SELECT =
  'rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-accent focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]'

/** As 2 datas mais recentes de avanco_arquivos pra uma Empresa+Escopo, a partir do estado já carregado (sem round-trip novo — mesma lista que alimenta Dashboard/Data_Base). `null` se não houver pelo menos 2. */
function calcularPar(arquivos, empresa, escopo) {
  const doEscopo = arquivos
    .filter((item) => item.empresa === empresa && item.escopo === escopo)
    .slice()
    .sort((a, b) => (a.data_referencia < b.data_referencia ? 1 : -1))
  if (doEscopo.length < 2) return null
  return { atual: doEscopo[0], anterior: doEscopo[1] }
}

// Quais pares (Carbono/Inox) cada opção de Agrupar precisa — usado só pra
// decidir se dá pra mostrar o resumo ou se falta data anterior de algum
// dos escopos envolvidos.
const ESCOPOS_POR_OPCAO_AGRUPAR = {
  carbono: ['carbono'],
  inox: ['inox'],
  equipamentos: ['inox'],
  tudo: ['carbono', 'inox'],
}

function CardComparacao({ categoria, titulo, itens, rotuloColuna, mensagemVazio }) {
  return (
    <Card faixaCor="#7c3aed" categoria={categoria} titulo={titulo}>
      <TabelaComparacaoAtualizacao itens={itens} rotuloColuna={rotuloColuna} mensagemVazio={mensagemVazio} />
    </Card>
  )
}

/**
 * Aba "Atualização": compara os itens de tubulação/suportes/equipamentos
 * (avanco_itens_tubulacao/avanco_itens_equipamento, migration 0024) entre
 * a data mais recente e a segunda mais recente de avanco_arquivos, pra uma
 * Empresa+Escopo — só existe pra empresas de tipoInput 'xlsx_qualisolda'
 * (hoje só QUALISOLDA; a FORTYS só tem os 6 indicadores agregados do
 * cronograma, sem item a item, então não entra aqui).
 */
export default function AvancoAtualizacao({ fase, arquivos, itensTubulacaoPorArquivo, itensEquipamentoPorArquivo }) {
  const empresasQualisolda = useMemo(
    () =>
      listarEmpresasDaFase(fase)
        .map(({ empresa }) => empresa)
        .filter((empresa) => buscarEmpresa(fase, empresa)?.tipoInput === 'xlsx_qualisolda'),
    [fase],
  )
  const [empresaSelecionada, setEmpresaSelecionada] = useState(empresasQualisolda[0] ?? '')
  const empresaAtiva = empresasQualisolda.includes(empresaSelecionada) ? empresaSelecionada : (empresasQualisolda[0] ?? '')

  const escopos = buscarEmpresa(fase, empresaAtiva)?.escopos ?? []
  const escopoCarbono = escopos.find((item) => ESCOPO_TIPO_QUALISOLDA[item] === 'carbono') ?? ''
  const escopoInox = escopos.find((item) => ESCOPO_TIPO_QUALISOLDA[item] === 'inox') ?? ''

  const [escopoSelecionado, setEscopoSelecionado] = useState('')
  const escopoAtivo = escopos.includes(escopoSelecionado) ? escopoSelecionado : (escopos[0] ?? '')
  const escopoTipoAtivo = ESCOPO_TIPO_QUALISOLDA[escopoAtivo]

  const [agrupar, setAgrupar] = useState('')

  const parCarbono = useMemo(
    () => (escopoCarbono ? calcularPar(arquivos, empresaAtiva, escopoCarbono) : null),
    [arquivos, empresaAtiva, escopoCarbono],
  )
  const parInox = useMemo(() => (escopoInox ? calcularPar(arquivos, empresaAtiva, escopoInox) : null), [arquivos, empresaAtiva, escopoInox])

  const itensDoArquivo = (arquivo) => (arquivo ? (itensTubulacaoPorArquivo.get(arquivo.id) ?? []) : [])
  const equipDoArquivo = (arquivo) => (arquivo ? (itensEquipamentoPorArquivo.get(arquivo.id) ?? []) : [])

  // Itens "crus" das 2 datas de cada escopo — usados tanto pela comparação
  // item a item (par do Escopo selecionado) quanto pelo resumo agrupado
  // (que pode precisar dos 2 escopos juntos, ex.: "Agrupar tudo").
  const itensAgrupar = {
    anterior: {
      itensCarbono: itensDoArquivo(parCarbono?.anterior).filter((item) => item.material === 'carbono'),
      itensInox: itensDoArquivo(parInox?.anterior).filter((item) => item.material === 'inox'),
      itensEquipamento: equipDoArquivo(parInox?.anterior),
    },
    atual: {
      itensCarbono: itensDoArquivo(parCarbono?.atual).filter((item) => item.material === 'carbono'),
      itensInox: itensDoArquivo(parInox?.atual).filter((item) => item.material === 'inox'),
      itensEquipamento: equipDoArquivo(parInox?.atual),
    },
  }

  if (empresasQualisolda.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400">Nenhuma empresa com dados item a item cadastrada nessa fase.</p>
  }

  const paresNecessariosAgrupar = agrupar
    ? ESCOPOS_POR_OPCAO_AGRUPAR[agrupar].map((tipo) => (tipo === 'carbono' ? parCarbono : parInox))
    : []
  const algumParDisponivelAgrupar = paresNecessariosAgrupar.some(Boolean)

  // Comparação item a item (só quando "Agrupar" está desligado) — sempre
  // do escopo selecionado no seletor "Escopo".
  const par = escopoTipoAtivo === 'carbono' ? parCarbono : parInox

  let isometricosAvancaram = []
  let suporteComparacao = []
  let equipamentosAvancaram = []
  let torresAvancaram = []

  if (!agrupar && par) {
    const itensAtual = itensDoArquivo(par.atual)
    const itensAnterior = itensDoArquivo(par.anterior)

    const isometricosAtual = itensAtual.filter((item) => item.tipo_registro === 'isometrico')
    const isometricosAnterior = itensAnterior.filter((item) => item.tipo_registro === 'isometrico')
    isometricosAvancaram = compararItens(isometricosAtual, isometricosAnterior, 'isometrico')

    const suporteAtual = itensAtual.find((item) => item.tipo_registro === 'suporte_resumo')
    const suporteAnterior = itensAnterior.find((item) => item.tipo_registro === 'suporte_resumo')
    if (suporteAtual) {
      suporteComparacao = compararItens([suporteAtual], suporteAnterior ? [suporteAnterior] : [], 'isometrico', { sempreTodos: true })
    }

    if (escopoTipoAtivo === 'inox') {
      const equipAtual = equipDoArquivo(par.atual)
      const equipAnterior = equipDoArquivo(par.anterior)
      equipamentosAvancaram = compararItens(
        equipAtual.filter((item) => item.classificacao === 'EQUIPAMENTO'),
        equipAnterior.filter((item) => item.classificacao === 'EQUIPAMENTO'),
        'tag',
      )
      torresAvancaram = compararItens(
        equipAtual.filter((item) => item.classificacao === 'TORRE'),
        equipAnterior.filter((item) => item.classificacao === 'TORRE'),
        'tag',
      )
    }
  }

  const nadaAvancouListas = isometricosAvancaram.length === 0 && equipamentosAvancaram.length === 0 && torresAvancaram.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        {empresasQualisolda.length > 1 ? (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
            Empresa
            <select value={empresaAtiva} onChange={(event) => setEmpresaSelecionada(event.target.value)} className={CLASSE_SELECT}>
              {empresasQualisolda.map((empresa) => (
                <option key={empresa} value={empresa}>
                  {empresa}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Empresa: <span className="font-medium text-navy dark:text-slate-100">{empresaAtiva}</span>
          </p>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
          Escopo
          <select value={escopoAtivo} onChange={(event) => setEscopoSelecionado(event.target.value)} className={CLASSE_SELECT}>
            {escopos.map((escopo) => (
              <option key={escopo} value={escopo}>
                {escopo}
              </option>
            ))}
          </select>
        </label>

        <SeletorAgrupar value={agrupar} onChange={setAgrupar} />
      </div>

      {agrupar ? (
        algumParDisponivelAgrupar ? (
          <ResumoAgrupadoComparacao opcao={agrupar} itensAnterior={itensAgrupar.anterior} itensAtual={itensAgrupar.atual} />
        ) : (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Ainda não há uma data anterior pra comparar nesse agrupamento (precisa de pelo menos 2 datas cadastradas no(s) escopo(s)
            envolvido(s)).
          </p>
        )
      ) : !par ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Ainda não há uma data anterior pra comparar.</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Comparando <span className="font-medium text-navy dark:text-slate-100">{formatarDataBR(par.atual.data_referencia)}</span> (atual)
            com <span className="font-medium text-navy dark:text-slate-100">{formatarDataBR(par.anterior.data_referencia)}</span> (anterior).
          </p>

          {suporteComparacao.length > 0 && (
            <CardComparacao
              categoria={escopoAtivo}
              titulo="Suportes"
              itens={suporteComparacao}
              rotuloColuna="Suportes"
              mensagemVazio="Sem dado de Suportes nessa comparação."
            />
          )}

          {nadaAvancouListas ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum avanço registrado nessa comparação.</p>
          ) : (
            <>
              {isometricosAvancaram.length > 0 && (
                <CardComparacao
                  categoria={escopoAtivo}
                  titulo={`Isométricos que avançaram (${isometricosAvancaram.length})`}
                  itens={isometricosAvancaram}
                  rotuloColuna="Isométrico"
                  mensagemVazio="Nenhum isométrico avançou nessa comparação."
                />
              )}

              {equipamentosAvancaram.length > 0 && (
                <CardComparacao
                  categoria={escopoAtivo}
                  titulo={`Equipamentos que avançaram (${equipamentosAvancaram.length})`}
                  itens={equipamentosAvancaram}
                  rotuloColuna="TAG"
                  mensagemVazio="Nenhum equipamento avançou nessa comparação."
                />
              )}

              {torresAvancaram.length > 0 && (
                <CardComparacao
                  categoria={escopoAtivo}
                  titulo={`Torres que avançaram (${torresAvancaram.length})`}
                  itens={torresAvancaram}
                  rotuloColuna="TAG"
                  mensagemVazio="Nenhuma torre avançou nessa comparação."
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
