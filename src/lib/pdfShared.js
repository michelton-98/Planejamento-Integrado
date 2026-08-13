import { LOGO_INPASA_BASE64, LOGO_PLAORC_BASE64 } from './logoAssets'

// Peças comuns a TODO relatório PDF do sistema (hoje: Controle de RDO em
// pdfReport.js e Controle de Validações em pdfReportValidacoes.js) — cores
// de marca, logos, cabeçalho/rodapé padrão e o bloco de cards de
// indicadores. Extraído daqui pra fora de pdfReport.js pra ser reaproveitado
// sem duplicar, mantendo os dois relatórios visualmente idênticos.

export const CORES = {
  navy: '#12263f',
  accent: '#2f6fed',
  alert: '#d1495b',
  success: '#178a54',
  gold: '#a9791f',
  cinzaClaro: '#f3f4f6',
  cinzaTrilha: '#e5e7eb',
  cinzaTexto: '#6b7280',
}

export const MARGEM_X = 40

export function hexParaRgb(hex) {
  const valor = hex.replace('#', '')
  return [
    parseInt(valor.slice(0, 2), 16),
    parseInt(valor.slice(2, 4), 16),
    parseInt(valor.slice(4, 6), 16),
  ]
}

export function formatarDataBR(data) {
  return data.toLocaleDateString('pt-BR')
}

export function formatarDataHoraBR(data) {
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
}

// As logos costumavam ser buscadas em tempo de execução via '/logos/*.png'
// — funcionava em dev mas falhava intermitentemente em produção no Vercel.
// Embutir como base64 (logoAssets.js) elimina essa requisição de rede.
function carregarImagem(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ dataUrl, aspecto: img.naturalWidth / img.naturalHeight })
    img.onerror = () => reject(new Error('Não foi possível carregar a logo embutida no PDF.'))
    img.src = dataUrl
  })
}

export async function carregarLogos() {
  const [logoInpasa, logoPlaorc] = await Promise.all([
    carregarImagem(LOGO_INPASA_BASE64),
    carregarImagem(LOGO_PLAORC_BASE64),
  ])
  return { logoInpasa, logoPlaorc }
}

/**
 * Cabeçalho padrão: logos INPASA/PLAORC nas pontas, título centralizado,
 * uma linha de subtítulo, uma nota em itálico opcional e uma linha
 * divisória navy. Posições fixas (mesmas de sempre, usadas originalmente só
 * no relatório de RDO) — retorna o Y logo abaixo da linha, de onde quem
 * chamou deve continuar desenhando o corpo do relatório.
 */
export function desenharCabecalho(doc, { logos, titulo, subtitulo, nota }) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const alturaLogo = 38
  doc.addImage(logos.logoInpasa.dataUrl, 'PNG', MARGEM_X, 20, alturaLogo * logos.logoInpasa.aspecto, alturaLogo)
  const larguraLogoPlaorc = alturaLogo * logos.logoPlaorc.aspecto
  doc.addImage(
    logos.logoPlaorc.dataUrl,
    'PNG',
    pageWidth - MARGEM_X - larguraLogoPlaorc,
    20,
    larguraLogoPlaorc,
    alturaLogo,
  )

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...hexParaRgb(CORES.navy))
  doc.text(titulo, pageWidth / 2, 70, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...hexParaRgb(CORES.cinzaTexto))
  doc.text(subtitulo, pageWidth / 2, 87, { align: 'center' })

  if (nota) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.text(nota, pageWidth / 2, 100, { align: 'center' })
  }

  doc.setDrawColor(...hexParaRgb(CORES.navy))
  doc.setLineWidth(1.2)
  doc.line(MARGEM_X, 110, pageWidth - MARGEM_X, 110)

  return 126
}

/**
 * Rodapé padrão: "Relatório gerado em <agora> · <textoReferencia>" à
 * esquerda, `rotuloPagina` à direita (quem chama decide o texto — "1" pra
 * relatório de 1 página só, "2 de 3" pra relatório paginado).
 */
export function desenharRodape(doc, textoReferencia, rotuloPagina) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const agora = new Date()

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...hexParaRgb(CORES.cinzaTexto))
  doc.text(`Relatório gerado em ${formatarDataHoraBR(agora)} · ${textoReferencia}`, MARGEM_X, pageHeight - 20)
  doc.text(rotuloPagina, pageWidth - MARGEM_X, pageHeight - 20, { align: 'right' })
}

/**
 * Fileira de cards de indicador (fundo cinza claro, friso colorido no
 * topo, rótulo + número grande) — mesmo visual dos StatCard da tela,
 * dividindo `largura` em partes iguais entre `indicadores`.
 */
export function desenharCardsIndicadores(doc, x, y, largura, indicadores, { gap = 12, alturaCard = 62 } = {}) {
  const larguraCard = (largura - gap * (indicadores.length - 1)) / indicadores.length

  indicadores.forEach((indicador, indice) => {
    const xCard = x + indice * (larguraCard + gap)

    doc.setFillColor(...hexParaRgb(CORES.cinzaClaro))
    doc.roundedRect(xCard, y, larguraCard, alturaCard, 4, 4, 'F')

    doc.setDrawColor(...hexParaRgb(indicador.cor))
    doc.setLineWidth(2.5)
    doc.line(xCard + 4, y + 1, xCard + larguraCard - 4, y + 1)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...hexParaRgb(CORES.cinzaTexto))
    doc.text(indicador.label, xCard + 10, y + 22, { maxWidth: larguraCard - 20 })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(...hexParaRgb(indicador.cor))
    doc.text(String(indicador.valor), xCard + 10, y + 49)
  })

  return alturaCard
}
