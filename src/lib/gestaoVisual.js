import { ESCOPO_TIPO_QUALISOLDA, INDICADORES_FORTYS } from './avancoIntegradoConfig'
import { somarPesos } from './qualisoldaAgrupamento'

// Helpers puros pro painel "Gestão Visual" do Dashboard de Destilaria Fase
// I (ver src/components/avanco/GestaoVisual.jsx) — todo cálculo aqui parte
// dos dados que a página já carregou (arquivos + indicadoresPorArquivo +
// itensTubulacaoPorArquivo + itensEquipamentoPorArquivo, ver
// FaseDestilaria.jsx), sem nenhum fetch próprio. Só olha pro arquivo MAIS
// RECENTE de cada empresa/escopo — igual ao resto do Dashboard (ver
// AvancoDashboard.jsx).

/** Item com maior data_referencia de uma lista já filtrada; null se vazia. */
export function arquivoMaisRecente(lista) {
  if (lista.length === 0) return null
  return lista.reduce((atual, item) => (item.data_referencia > atual.data_referencia ? item : atual))
}

function arquivoMaisRecenteDoEscopoQualisolda(arquivos, tipoEscopo) {
  return arquivoMaisRecente(
    arquivos.filter((item) => item.empresa === 'QUALISOLDA' && ESCOPO_TIPO_QUALISOLDA[item.escopo] === tipoEscopo),
  )
}

/**
 * Card "Estrutura": os 6 indicadores da FORTYS (ver INDICADORES_FORTYS), na
 * ordem fixa, com o percentual_executado do arquivo mais recente da
 * FORTYS — `percentual: null` pro indicador sem dado (nenhum arquivo da
 * FORTYS ainda, ou indicador ausente naquele arquivo).
 */
export function indicadoresEstrutura(arquivos, indicadoresPorArquivo) {
  const arquivo = arquivoMaisRecente(arquivos.filter((item) => item.empresa === 'FORTYS'))
  const indicadores = arquivo ? (indicadoresPorArquivo.get(arquivo.id) ?? []) : []
  const porNome = new Map(indicadores.map((item) => [item.nome_indicador, item]))

  return INDICADORES_FORTYS.map((nome) => ({
    nome,
    percentual: porNome.get(nome)?.percentual_executado ?? null,
  }))
}

// Os 4 status derivados de percentual_total/percentual_montagem (ver
// classificarIsometrico) — ordem fixa de exibição (donut + legenda).
export const STATUS_ISOMETRICO = [
  { chave: 'nao_iniciado', rotulo: 'Não Iniciado' },
  { chave: 'em_fabricacao', rotulo: 'Em Fabricação' },
  { chave: 'em_montagem', rotulo: 'Em Montagem' },
  { chave: 'concluido', rotulo: 'Concluído' },
]

/** Classifica UM isométrico (avanco_itens_tubulacao, tipo_registro='isometrico') num dos 4 status de STATUS_ISOMETRICO. */
export function classificarIsometrico(item) {
  const total = Number(item.percentual_total) || 0
  const montagem = Number(item.percentual_montagem) || 0
  if (total >= 100) return 'concluido'
  if (total === 0) return 'nao_iniciado'
  if (montagem === 0) return 'em_fabricacao'
  return 'em_montagem'
}

/**
 * Contagem dos 4 status entre os isométricos (tipo_registro='isometrico',
 * exclui a linha de resumo de Suportes) do arquivo mais recente de UM
 * material QUALISOLDA ('carbono' | 'inox') — cards "Isométricos
 * Carbono"/"Isométricos Inox".
 */
export function statusIsometricos(arquivos, itensTubulacaoPorArquivo, material) {
  const arquivo = arquivoMaisRecenteDoEscopoQualisolda(arquivos, material)
  const itens = arquivo ? (itensTubulacaoPorArquivo.get(arquivo.id) ?? []).filter((item) => item.tipo_registro === 'isometrico') : []

  const contagem = { nao_iniciado: 0, em_fabricacao: 0, em_montagem: 0, concluido: 0 }
  for (const item of itens) contagem[classificarIsometrico(item)]++

  return { arquivo, total: itens.length, contagem }
}

/** Itens de avanco_itens_equipamento do arquivo mais recente do escopo Inox (único escopo com essa tabela preenchida). */
function itensEquipamentoInoxMaisRecente(arquivos, itensEquipamentoPorArquivo) {
  const arquivo = arquivoMaisRecenteDoEscopoQualisolda(arquivos, 'inox')
  return arquivo ? (itensEquipamentoPorArquivo.get(arquivo.id) ?? []) : []
}

/** Card "SI's": % avanço geral (peso_executado / peso_total) dos equipamentos cuja TAG comece com "SI" (case-insensitive). */
export function avancoSI(arquivos, itensEquipamentoPorArquivo) {
  const itens = itensEquipamentoInoxMaisRecente(arquivos, itensEquipamentoPorArquivo)
  return somarPesos(itens.filter((item) => (item.tag ?? '').toUpperCase().startsWith('SI')))
}

/** Card "Trocador de Calor de Barras": % avanço geral dos itens marcados (ver migration 0025), independente de tipo_equipamento. */
export function avancoTrocadorCalorBarras(arquivos, itensEquipamentoPorArquivo) {
  const itens = itensEquipamentoInoxMaisRecente(arquivos, itensEquipamentoPorArquivo)
  return somarPesos(itens.filter((item) => item.trocador_calor_barras === true))
}

/** Itens classificados como TORRE (avanco_itens_equipamento) do arquivo mais recente — usado pro card "Torres" (Montagem) e "Bandejamento Interno" (lista de TAGs). */
export function itensTorres(arquivos, itensEquipamentoPorArquivo) {
  return itensEquipamentoInoxMaisRecente(arquivos, itensEquipamentoPorArquivo).filter((item) => item.classificacao === 'TORRE')
}

/** Card "Torres" — coluna "Montagem": % avanço geral ponderado por peso das TORRES. */
export function avancoTorresMontagem(arquivos, itensEquipamentoPorArquivo) {
  return somarPesos(itensTorres(arquivos, itensEquipamentoPorArquivo))
}

/** Card "Bombas" — coluna "Montagem": % avanço geral ponderado por peso dos equipamentos cujo tipo_equipamento contenha "bomba" (case-insensitive). */
export function avancoBombasMontagem(arquivos, itensEquipamentoPorArquivo) {
  const itens = itensEquipamentoInoxMaisRecente(arquivos, itensEquipamentoPorArquivo)
  return somarPesos(itens.filter((item) => (item.tipo_equipamento ?? '').toLowerCase().includes('bomba')))
}
