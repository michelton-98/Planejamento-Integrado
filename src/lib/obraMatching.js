// Lógica de correspondência entre um item (RDO importado ou linha da
// planilha de Escopos) e um registro de `obras_escopos`, reaproveitada
// tanto no merge de importação (obrasEscoposData.js) quanto no filtro do
// dashboard por status de obra (dashboardData.js).
//
// Regra: empresa + escopo é SEMPRE a chave de vínculo (com tolerância a
// diferença de maiúsculas/espaços/acentos). numero_contrato não é único
// (uma empresa pode ter vários contratos, e um mesmo contrato pode cobrir
// vários escopos) — por isso nunca é usado como critério de busca, só
// como dado complementar exibido a partir da obra encontrada.

/** Chave normalizada de "empresa + escopo" — case/acento/espaço-insensível. */
export function normalizarChaveObra(empresa, escopo) {
  const normalizar = (texto) =>
    String(texto ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')

  return `${normalizar(empresa)}|${normalizar(escopo)}`
}

/** Monta o índice por empresa+escopo usado na busca. */
export function construirIndiceObras(obras) {
  const porChave = new Map()

  for (const obra of obras) {
    const chave = normalizarChaveObra(obra.empresa, obra.escopo)
    if (!porChave.has(chave)) {
      porChave.set(chave, obra)
    }
  }

  return { porChave }
}

/**
 * Encontra a obra correspondente a `item` (precisa de `empresa`, `escopo`)
 * usando o índice de `construirIndiceObras`. Retorna `null` se nenhuma
 * obra bater.
 */
export function encontrarObraCorrespondente(item, { porChave }) {
  const chave = normalizarChaveObra(item.empresa, item.escopo)
  return porChave.get(chave) ?? null
}

/**
 * Agrupa RDOs (de rdo_relatorios) que não encontraram nenhuma obra
 * correspondente em `obras` — por empresa+escopo únicos, com a contagem
 * de RDOs afetados por grupo. Usado no indicador "RDOs sem obra
 * cadastrada" da tela de importação, para o admin identificar rapidamente
 * obras novas que ainda não foram cadastradas em Escopos - Rondonópolis.
 */
export function agruparRdosSemObra(rows, obras) {
  const indice = construirIndiceObras(obras)
  const semObraPorChave = new Map()

  for (const row of rows) {
    if (encontrarObraCorrespondente(row, indice)) continue

    const chave = normalizarChaveObra(row.empresa, row.escopo)
    if (!semObraPorChave.has(chave)) {
      semObraPorChave.set(chave, {
        empresa: row.empresa,
        escopo: row.escopo,
        numero_contrato: row.numero_contrato,
        total: 0,
      })
    }
    semObraPorChave.get(chave).total += 1
  }

  return Array.from(semObraPorChave.values()).sort((a, b) => b.total - a.total)
}
