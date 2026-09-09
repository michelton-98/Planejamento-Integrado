import FaseDestilaria from './FaseDestilaria'

/**
 * Ferramenta "Destilaria Fase II" (/avanco-integrado/destilaria-fase-2) —
 * mesma estrutura de DestilariaFase1.jsx (ver FaseDestilaria.jsx), só com
 * `fase` diferente. Só a FORTYS está cadastrada aqui por enquanto (ver
 * AVANCO_CONFIG.destilaria_fase_2 em avancoIntegradoConfig.js) — os dados
 * chegam automaticamente pelo mesmo upload do cronograma único da FORTYS
 * feito em Destilaria Fase I (ver fortysXmlParse.js/enviarArquivoFortysXml).
 */
export default function DestilariaFase2() {
  return <FaseDestilaria fase="destilaria_fase_2" titulo="Destilaria Fase II" />
}
