import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { computeNomesComContagem } from './dashboardData'

// Paleta de marca (mesmos hex usados no restante do dashboard).
const COR_NAVY = '#12263f'
const COR_ACCENT = '#2f6fed'
const COR_ALERT = '#d1495b'
const COR_CINZA_CLARO = '#f3f4f6'
const COR_CINZA_TEXTO = '#6b7280'

const MARGEM_X = 40

function hexParaRgb(hex) {
  const valor = hex.replace('#', '')
  return [
    parseInt(valor.slice(0, 2), 16),
    parseInt(valor.slice(2, 4), 16),
    parseInt(valor.slice(4, 6), 16),
  ]
}

// Carrega um PNG estático (mesmo domínio, sem CORS) e devolve como data URL
// + proporção largura/altura, para desenhar no PDF com addImage.
function carregarImagem(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        aspecto: img.naturalWidth / img.naturalHeight,
      })
    }
    img.onerror = () => reject(new Error(`Não foi possível carregar a imagem: ${src}`))
    img.src = src
  })
}

function formatarDataBR(data) {
  return data.toLocaleDateString('pt-BR')
}

function formatarDataHoraBR(data) {
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
}

function chaveDataLocal(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function desenharRodape(doc, dataReferencia) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const agora = new Date()

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...hexParaRgb(COR_CINZA_TEXTO))
  doc.text(
    `Relatório gerado em ${formatarDataHoraBR(agora)} · Referente a ${formatarDataBR(dataReferencia)}`,
    MARGEM_X,
    pageHeight - 20,
  )
  doc.text(String(doc.internal.getNumberOfPages()), pageWidth - MARGEM_X, pageHeight - 20, {
    align: 'right',
  })
}

/**
 * Gera e baixa (client-side, sem backend) o PDF do relatório diário de
 * acompanhamento de RDOs. `stats`, `topEmpresas` e `topEspecialistas` já
 * vêm calculados pelo dashboard (dashboardData.js) — os números do PDF são
 * sempre os mesmos que a tela mostra no momento do clique.
 */
export async function gerarRelatorioDiarioPdf({
  rows,
  dataReferencia,
  stats,
  topEmpresas,
  topEspecialistas,
}) {
  const [logoInpasa, logoPlaorc] = await Promise.all([
    carregarImagem('/logos/inpasa.png'),
    carregarImagem('/logos/plaorc.png'),
  ])

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const larguraUtil = pageWidth - MARGEM_X * 2

  // --- Cabeçalho -----------------------------------------------------
  const alturaLogo = 32
  doc.addImage(logoInpasa.dataUrl, 'PNG', MARGEM_X, 24, alturaLogo * logoInpasa.aspecto, alturaLogo)
  const larguraLogoPlaorc = alturaLogo * logoPlaorc.aspecto
  doc.addImage(
    logoPlaorc.dataUrl,
    'PNG',
    pageWidth - MARGEM_X - larguraLogoPlaorc,
    24,
    larguraLogoPlaorc,
    alturaLogo,
  )

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...hexParaRgb(COR_NAVY))
  doc.text('Relatório Diário de Acompanhamento de RDOs', pageWidth / 2, 74, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...hexParaRgb(COR_CINZA_TEXTO))
  doc.text(`Data de referência: ${formatarDataBR(dataReferencia)}`, pageWidth / 2, 90, {
    align: 'center',
  })

  doc.setDrawColor(...hexParaRgb(COR_NAVY))
  doc.setLineWidth(1.2)
  doc.line(MARGEM_X, 102, pageWidth - MARGEM_X, 102)

  // --- Resumo executivo ------------------------------------------------
  const indicadores = [
    { label: 'Total a Aprovar', valor: stats.total, cor: COR_NAVY },
    { label: 'Aprovações Atrasadas', valor: stats.atrasadas, cor: COR_ALERT },
    { label: 'Pendentes Contratada', valor: stats.pendenteContratada, cor: COR_NAVY },
    { label: 'Pendentes Especialista', valor: stats.pendenteEspecialista, cor: COR_NAVY },
  ]

  const gap = 12
  const larguraCard = (larguraUtil - gap * 3) / 4
  const alturaCard = 58
  const yCards = 120

  indicadores.forEach((indicador, indice) => {
    const x = MARGEM_X + indice * (larguraCard + gap)

    doc.setFillColor(...hexParaRgb(COR_CINZA_CLARO))
    doc.roundedRect(x, yCards, larguraCard, alturaCard, 4, 4, 'F')

    doc.setDrawColor(...hexParaRgb(COR_NAVY))
    doc.setLineWidth(2)
    doc.line(x + 4, yCards + 1, x + larguraCard - 4, yCards + 1)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...hexParaRgb(COR_CINZA_TEXTO))
    doc.text(indicador.label, x + 10, yCards + 20, { maxWidth: larguraCard - 20 })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(...hexParaRgb(indicador.cor))
    doc.text(String(indicador.valor), x + 10, yCards + 46)
  })

  let y = yCards + alturaCard + 32

  // --- Top 5 empresas / especialistas -----------------------------------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...hexParaRgb(COR_NAVY))
  doc.text('Top 5 com mais pendências atrasadas', MARGEM_X, y)
  y += 10

  const larguraColuna = (larguraUtil - gap) / 2
  const estiloCabecalho = { fillColor: hexParaRgb(COR_ACCENT), textColor: 255, fontSize: 9 }
  const estiloCorpo = { fontSize: 9, textColor: hexParaRgb(COR_NAVY) }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM_X },
    tableWidth: larguraColuna,
    head: [['Empresa', 'Atrasadas']],
    body: topEmpresas.length
      ? topEmpresas.map((item) => [item.nome, String(item.total)])
      : [['Sem dados', '']],
    headStyles: estiloCabecalho,
    bodyStyles: estiloCorpo,
    styles: { cellPadding: 4 },
  })
  const finalYEmpresas = doc.lastAutoTable.finalY

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM_X + larguraColuna + gap },
    tableWidth: larguraColuna,
    head: [['Especialista', 'Atrasadas']],
    body: topEspecialistas.length
      ? topEspecialistas.map((item) => [item.nome, String(item.total)])
      : [['Sem dados', '']],
    headStyles: estiloCabecalho,
    bodyStyles: estiloCorpo,
    styles: { cellPadding: 4 },
  })
  const finalYEspecialistas = doc.lastAutoTable.finalY

  y = Math.max(finalYEmpresas, finalYEspecialistas) + 28

  // --- Lista completa de especialistas -----------------------------------
  const especialistas = computeNomesComContagem(rows, 'especialista')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...hexParaRgb(COR_NAVY))
  doc.text('Pendências por especialista (status: pendente especialista)', MARGEM_X, y)
  y += 10

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM_X, right: MARGEM_X, bottom: 40 },
    head: [['Especialista', 'Quantidade de pendências']],
    body: especialistas.length
      ? especialistas.map((item) => [item.nome, String(item.total)])
      : [['Sem dados', '']],
    headStyles: estiloCabecalho,
    bodyStyles: estiloCorpo,
    alternateRowStyles: { fillColor: hexParaRgb(COR_CINZA_CLARO) },
    styles: { cellPadding: 5 },
    didDrawPage: () => desenharRodape(doc, dataReferencia),
  })

  // Garante o rodapé mesmo se, por algum motivo, o hook acima não tiver
  // desenhado nada na última página renderizada.
  desenharRodape(doc, dataReferencia)

  doc.save(`relatorio-rdo-${chaveDataLocal(dataReferencia)}.pdf`)
}
