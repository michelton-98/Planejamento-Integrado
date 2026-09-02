// Helpers compartilhados entre AvancoDataBase.jsx e AvancoAtualizacao.jsx
// pra 2 recursos que usam a MESMA lógica de agregação sobre os itens da
// QUALISOLDA (avanco_itens_tubulacao / avanco_itens_equipamento, migration
// 0024): o seletor "Agrupar" (resumo peso previsto/executado/% avanço de um
// grupo de itens) e a comparação "avançou entre 2 datas" da aba Atualização.

/** '—' pra peso ausente; senão formatado em pt-BR com no máx. 1 casa decimal. */
export function formatarPeso(valor) {
  if (valor === null || valor === undefined) return '—'
  return Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

// As 4 opções do seletor "Agrupar" (Data_Base e Atualização) — cada uma
// decide QUAIS itens entram na soma (ver montarResumoAgrupado). A ordem
// aqui é a ordem de exibição no seletor.
export const OPCOES_AGRUPAR = [
  { chave: 'carbono', rotulo: 'Interligação de Carbono + Suportes' },
  { chave: 'inox', rotulo: 'Interligação de Inox + Suportes' },
  { chave: 'equipamentos', rotulo: 'Equipamentos' },
  { chave: 'tudo', rotulo: 'Agrupar tudo' },
]

/**
 * Soma peso_total ("Peso Previsto") e peso_executado de uma lista de itens
 * (avanco_itens_tubulacao OU avanco_itens_equipamento — mesmos 2 nomes de
 * coluna nas 2 tabelas) + o % avanço do grupo (peso_executado ÷ peso_total,
 * NADA a ver com percentual_previsto_geral — esse é exclusivo do
 * cronograma da FORTYS e não existe pra QUALISOLDA).
 */
export function somarPesos(itens) {
  const pesoTotal = itens.reduce((soma, item) => soma + (Number(item.peso_total) || 0), 0)
  const pesoExecutado = itens.reduce((soma, item) => soma + (Number(item.peso_executado) || 0), 0)
  const percentual = pesoTotal > 0 ? (pesoExecutado / pesoTotal) * 100 : null
  return { pesoTotal, pesoExecutado, percentual }
}

/**
 * Resumo agrupado pra UMA opção de Agrupar, a partir dos itens "crus" já
 * separados por escopo/tipo: `itensCarbono` (tubulação+suportes,
 * material='carbono'), `itensInox` (tubulação+suportes, material='inox') e
 * `itensEquipamento` (avanco_itens_equipamento, só existe no escopo Inox).
 * Devolve `{ total, subtotais? }` — `subtotais` só existe na opção
 * 'equipamentos' (Equipamentos vs Torres, ver prompt original).
 */
export function montarResumoAgrupado(opcao, { itensCarbono, itensInox, itensEquipamento }) {
  if (opcao === 'carbono') return { total: somarPesos(itensCarbono) }
  if (opcao === 'inox') return { total: somarPesos(itensInox) }

  if (opcao === 'equipamentos') {
    const equipamentos = itensEquipamento.filter((item) => item.classificacao === 'EQUIPAMENTO')
    const torres = itensEquipamento.filter((item) => item.classificacao === 'TORRE')
    return {
      total: somarPesos(itensEquipamento),
      subtotais: [
        { rotulo: 'Equipamentos', ...somarPesos(equipamentos) },
        { rotulo: 'Torres', ...somarPesos(torres) },
      ],
    }
  }

  // 'tudo': soma as 3 opções acima — equivale a somar todos os itens juntos.
  return { total: somarPesos([...itensCarbono, ...itensInox, ...itensEquipamento]) }
}

/**
 * Compara 2 listas de itens do MESMO tipo (isométricos, o resumo de
 * Suportes, ou equipamentos/torres) por uma chave de identidade (nome do
 * isométrico ou TAG) — usado na aba Atualização. Item sem correspondente na
 * lista anterior conta como 0% (ver prompt original: "se não existia
 * antes, tratar % anterior como 0"). Por padrão só devolve os que
 * avançaram (percentual_total atual > anterior); `sempreTodos` (usado pro
 * resumo de Suportes, que é sempre exatamente 1 linha) devolve todos.
 */
export function compararItens(itensAtuais, itensAnteriores, chave, { sempreTodos = false } = {}) {
  const anterioresPorChave = new Map(itensAnteriores.map((item) => [item[chave], item]))

  const comparacoes = itensAtuais.map((atual) => {
    const anterior = anterioresPorChave.get(atual[chave]) ?? null
    const percentualAnterior = Number(anterior?.percentual_total) || 0
    const percentualAtual = Number(atual.percentual_total) || 0
    const pesoExecutadoAnterior = Number(anterior?.peso_executado) || 0
    const pesoExecutadoAtual = Number(atual.peso_executado) || 0

    return {
      chave: atual[chave],
      percentualAnterior,
      percentualAtual,
      deltaPercentual: percentualAtual - percentualAnterior,
      pesoExecutadoAnterior,
      pesoExecutadoAtual,
      deltaPeso: pesoExecutadoAtual - pesoExecutadoAnterior,
    }
  })

  return sempreTodos ? comparacoes : comparacoes.filter((item) => item.deltaPercentual > 0)
}
