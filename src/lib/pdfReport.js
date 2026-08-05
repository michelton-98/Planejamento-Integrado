import { jsPDF } from 'jspdf'
import { LOGO_INPASA_BASE64, LOGO_PLAORC_BASE64 } from './logoAssets'

// Paleta de marca (mesmos hex usados no restante do dashboard).
const COR_NAVY = '#12263f'
const COR_ACCENT = '#2f6fed'
const COR_ALERT = '#d1495b'
const COR_CINZA_CLARO = '#f3f4f6'
const COR_CINZA_TRILHA = '#e5e7eb'
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

// Lê a proporção largura/altura de uma logo já embutida como data URL
// (logoAssets.js). As logos costumavam ser buscadas em tempo de execução
// via '/logos/*.png' — funcionava em dev mas falhava intermitentemente em
// produção no Vercel (a imagem não carregava, mesmo com o arquivo commitado
// e o caminho correto). Embutir como base64 elimina essa requisição de
// rede por completo: não há mais dependência do servidor estático.
function carregarImagem(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ dataUrl, aspecto: img.naturalWidth / img.naturalHeight })
    img.onerror = () => reject(new Error('Não foi possível carregar a logo embutida no PDF.'))
    img.src = dataUrl
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

// --- Gauge de meia-rosca desenhado em vetor puro (mesma técnica/matemática
// do GaugeChart.jsx da tela: um ponto por percentual ao longo de um arco de
// 180° a 0°, indo da esquerda pro topo até a direita) — jsPDF não tem
// primitiva nativa de arco, então aproxima com um polígono fino (arco
// externo + arco interno) preenchido, um "anel" por segmento colorido. ---

function polarParaCartesiano(cx, cy, r, percent) {
  const angulo = 180 - (percent / 100) * 180
  const rad = (angulo * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) }
}

function desenharAnelGauge(doc, cx, cy, outerR, innerR, percentInicio, percentFim, corHex) {
  if (percentFim <= percentInicio) return

  const passos = Math.max(2, Math.round(((percentFim - percentInicio) / 100) * 40))
  const pontos = []
  for (let i = 0; i <= passos; i++) {
    const p = percentInicio + ((percentFim - percentInicio) * i) / passos
    pontos.push(polarParaCartesiano(cx, cy, outerR, p))
  }
  for (let i = passos; i >= 0; i--) {
    const p = percentInicio + ((percentFim - percentInicio) * i) / passos
    pontos.push(polarParaCartesiano(cx, cy, innerR, p))
  }

  const deltas = []
  for (let i = 1; i < pontos.length; i++) {
    deltas.push([pontos[i].x - pontos[i - 1].x, pontos[i].y - pontos[i - 1].y])
  }

  doc.setFillColor(...hexParaRgb(corHex))
  doc.lines(deltas, pontos[0].x, pontos[0].y, [1, 1], 'F', true)
}

function desenharUmGauge(doc, cx, cy, raio, espessura, segments, valorLabel, linhasLegenda) {
  const outerR = raio
  const innerR = raio - espessura

  desenharAnelGauge(doc, cx, cy, outerR, innerR, 0, 100, COR_CINZA_TRILHA)

  let acumulado = 0
  for (const segmento of segments) {
    if (segmento.value <= 0) continue
    const inicio = acumulado
    const fim = Math.min(acumulado + segmento.value, 100)
    desenharAnelGauge(doc, cx, cy, outerR, innerR, inicio, fim, segmento.color)
    acumulado = fim
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...hexParaRgb(COR_NAVY))
  doc.text(valorLabel, cx, cy - 3, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...hexParaRgb(COR_CINZA_TEXTO))
  linhasLegenda.forEach((linha, indice) => {
    doc.text(linha, cx, cy + 15 + indice * 10, { align: 'center' })
  })
}

/** Gauges "Taxa de Atraso" e "Especialista x Contratada", lado a lado. */
function desenharGauges(doc, x, y, largura, stats) {
  const raio = 44
  const espessura = 13
  const larguraGauge = largura / 2
  const cy = y + raio + 6

  const pctAtraso = stats.total ? (stats.atrasadas / stats.total) * 100 : 0
  desenharUmGauge(
    doc,
    x + larguraGauge / 2,
    cy,
    raio,
    espessura,
    [{ value: pctAtraso, color: COR_ALERT }],
    `${Math.round(pctAtraso)}%`,
    ['Taxa de Atraso', `${stats.atrasadas} de ${stats.total}`],
  )

  const denomEstagio = stats.pendenteEspecialista + stats.pendenteContratada
  const pctEspecialista = denomEstagio ? (stats.pendenteEspecialista / denomEstagio) * 100 : 0
  const pctContratada = 100 - pctEspecialista

  desenharUmGauge(
    doc,
    x + larguraGauge + larguraGauge / 2,
    cy,
    raio,
    espessura,
    denomEstagio
      ? [
          { value: pctEspecialista, color: COR_ACCENT },
          { value: pctContratada, color: COR_NAVY },
        ]
      : [],
    denomEstagio ? `${Math.round(pctEspecialista)}%` : '—',
    [
      'Especialista x Contratada',
      denomEstagio
        ? `Esp. ${Math.round(pctEspecialista)}% · Contr. ${Math.round(pctContratada)}%`
        : 'Sem dados',
    ],
  )
}

/** Barras horizontais de "Pendências por Disciplina", já na ordem exibida na tela. */
function desenharDisciplinas(doc, x, y, largura, pendencias) {
  const maxTotal = Math.max(...pendencias.map((p) => p.total), 0)
  const alturaLinha = 16
  const larguraRotulo = 76
  const larguraBarraMax = largura - larguraRotulo - 22

  pendencias.forEach((item, indice) => {
    const yLinha = y + indice * alturaLinha

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...hexParaRgb(COR_NAVY))
    doc.text(item.disciplina, x, yLinha + 6)

    doc.setFillColor(...hexParaRgb(COR_CINZA_TRILHA))
    doc.roundedRect(x + larguraRotulo, yLinha, larguraBarraMax, 7, 2, 2, 'F')

    const larguraBarra = maxTotal ? (item.total / maxTotal) * larguraBarraMax : 0
    if (larguraBarra > 0) {
      doc.setFillColor(...hexParaRgb(COR_ACCENT))
      doc.roundedRect(x + larguraRotulo, yLinha, larguraBarra, 7, 2, 2, 'F')
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(String(item.total), x + largura - 4, yLinha + 6, { align: 'right' })
  })

  return pendencias.length * alturaLinha
}

/**
 * Tabela de ranking (nome + contagem) desenhada manualmente (sem
 * autoTable — a dependência foi removida por não ter mais uso): título,
 * cabeçalho com fundo cor de destaque, linhas com zebra. Trunca o que não
 * couber em `alturaDisponivel` (nunca gera 2ª página) e sinaliza com uma
 * nota, embora com Top 10 isso raramente aconteça na prática.
 */
function desenharTabelaRanking(doc, x, y, largura, titulo, itens, alturaDisponivel) {
  // 9.5pt é o maior tamanho em que os dois títulos ("Top 10 empresas..."
  // e "Top 10 especialistas...", esse último mais longo) cabem numa linha
  // só dentro da largura da coluna — testado com doc.getTextWidth. Em
  // 10.5pt o de especialistas quebrava em 2 linhas e sobrepunha a tabela
  // logo abaixo. Mesmo tamanho nos dois títulos por consistência visual.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...hexParaRgb(COR_NAVY))
  doc.text(titulo, x, y, { maxWidth: largura })

  const yTabela = y + 12
  const alturaCabecalho = 16
  const alturaLinha = 13.5

  doc.setFillColor(...hexParaRgb(COR_ACCENT))
  doc.rect(x, yTabela, largura, alturaCabecalho, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  doc.text('NOME', x + 6, yTabela + alturaCabecalho - 5)
  doc.text('ATRASADAS', x + largura - 6, yTabela + alturaCabecalho - 5, { align: 'right' })

  if (itens.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...hexParaRgb(COR_CINZA_TEXTO))
    doc.text('Sem dados', x + 6, yTabela + alturaCabecalho + 10)
    return
  }

  const linhasDisponiveis = Math.max(
    0,
    Math.floor((alturaDisponivel - (yTabela - y) - alturaCabecalho) / alturaLinha),
  )
  const visiveis = itens.slice(0, linhasDisponiveis)
  const ocultos = itens.length - visiveis.length

  visiveis.forEach((item, indice) => {
    const yLinha = yTabela + alturaCabecalho + indice * alturaLinha

    if (indice % 2 === 1) {
      doc.setFillColor(...hexParaRgb(COR_CINZA_CLARO))
      doc.rect(x, yLinha, largura, alturaLinha, 'F')
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...hexParaRgb(COR_NAVY))
    doc.text(item.nome, x + 6, yLinha + alturaLinha - 4, { maxWidth: largura - 60 })

    doc.setFont('helvetica', 'bold')
    doc.text(String(item.total), x + largura - 6, yLinha + alturaLinha - 4, { align: 'right' })
  })

  if (ocultos > 0) {
    const yNota = yTabela + alturaCabecalho + visiveis.length * alturaLinha + 10
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.setTextColor(...hexParaRgb(COR_CINZA_TEXTO))
    doc.text(`+ ${ocultos} não exibido(s) por limite de espaço.`, x, yNota)
  }
}

/**
 * Gera e baixa (client-side, sem backend) o PDF do relatório de
 * acompanhamento de RDOs, formatado para caber em exatamente 1 página A4
 * (foco executivo: cabeçalho, KPIs, gauges, pendências por disciplina e
 * Top 10 empresas/especialistas — sem o heatmap nem o explorador de
 * pendências, que não fazem sentido impressos). `stats`,
 * `pendenciasPorDisciplina`, `topEmpresas` e `topEspecialistas` já vêm
 * calculados pelo dashboard (dashboardData.js) — `topEmpresas`/
 * `topEspecialistas` aqui são Top 10 (o dashboard interativo continua
 * mostrando Top 5, sem alteração; o limite maior é só para o PDF).
 */
export async function gerarRelatorioDiarioPdf({
  dataReferencia,
  ultimaAtualizacao,
  stats,
  topEmpresas,
  topEspecialistas,
  pendenciasPorDisciplina,
}) {
  const [logoInpasa, logoPlaorc] = await Promise.all([
    carregarImagem(LOGO_INPASA_BASE64),
    carregarImagem(LOGO_PLAORC_BASE64),
  ])

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const larguraUtil = pageWidth - MARGEM_X * 2
  const gap = 12

  // --- Cabeçalho -----------------------------------------------------
  const alturaLogo = 38
  doc.addImage(logoInpasa.dataUrl, 'PNG', MARGEM_X, 20, alturaLogo * logoInpasa.aspecto, alturaLogo)
  const larguraLogoPlaorc = alturaLogo * logoPlaorc.aspecto
  doc.addImage(
    logoPlaorc.dataUrl,
    'PNG',
    pageWidth - MARGEM_X - larguraLogoPlaorc,
    20,
    larguraLogoPlaorc,
    alturaLogo,
  )

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...hexParaRgb(COR_NAVY))
  doc.text('Relatório de Acompanhamento de RDOs', pageWidth / 2, 70, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...hexParaRgb(COR_CINZA_TEXTO))
  const ultimaAtualizacaoTexto = ultimaAtualizacao
    ? formatarDataHoraBR(new Date(ultimaAtualizacao))
    : '—'
  doc.text(
    `Data de referência: ${formatarDataBR(dataReferencia)}   ·   Última atualização: ${ultimaAtualizacaoTexto}`,
    pageWidth / 2,
    87,
    { align: 'center' },
  )

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.text(
    'Considerado atraso quando a aprovação ultrapassa 2 dias úteis a partir da data do RDO.',
    pageWidth / 2,
    100,
    { align: 'center' },
  )

  doc.setDrawColor(...hexParaRgb(COR_NAVY))
  doc.setLineWidth(1.2)
  doc.line(MARGEM_X, 110, pageWidth - MARGEM_X, 110)

  // --- KPIs ------------------------------------------------------------
  const indicadores = [
    { label: 'Total a Aprovar', valor: stats.total, cor: COR_NAVY },
    { label: 'Aprovações Atrasadas', valor: stats.atrasadas, cor: COR_ALERT },
    { label: 'Pendentes Contratada', valor: stats.pendenteContratada, cor: COR_NAVY },
    { label: 'Pendentes Especialista', valor: stats.pendenteEspecialista, cor: COR_NAVY },
  ]

  const larguraCard = (larguraUtil - gap * 3) / 4
  const alturaCard = 62
  const yCards = 126

  indicadores.forEach((indicador, indice) => {
    const x = MARGEM_X + indice * (larguraCard + gap)

    doc.setFillColor(...hexParaRgb(COR_CINZA_CLARO))
    doc.roundedRect(x, yCards, larguraCard, alturaCard, 4, 4, 'F')

    doc.setDrawColor(...hexParaRgb(indicador.cor))
    doc.setLineWidth(2.5)
    doc.line(x + 4, yCards + 1, x + larguraCard - 4, yCards + 1)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...hexParaRgb(COR_CINZA_TEXTO))
    doc.text(indicador.label, x + 10, yCards + 22, { maxWidth: larguraCard - 20 })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(...hexParaRgb(indicador.cor))
    doc.text(String(indicador.valor), x + 10, yCards + 49)
  })

  let y = yCards + alturaCard + 30

  // --- Indicadores (gauges) + Pendências por Disciplina, lado a lado ----
  const larguraColuna = (larguraUtil - gap) / 2
  const xColunaEsquerda = MARGEM_X
  const xColunaDireita = MARGEM_X + larguraColuna + gap

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...hexParaRgb(COR_NAVY))
  doc.text('Indicadores', xColunaEsquerda, y)
  doc.text('Pendências por Disciplina', xColunaDireita, y)

  const yBlocos = y + 16
  desenharGauges(doc, xColunaEsquerda, yBlocos, larguraColuna, stats)
  desenharDisciplinas(doc, xColunaDireita, yBlocos + 4, larguraColuna, pendenciasPorDisciplina)

  y = yBlocos + 140

  // --- Top 10 empresas / especialistas, lado a lado ---------------------
  const pageHeight = doc.internal.pageSize.getHeight()
  const alturaDisponivel = pageHeight - 34 - y // 34pt de folga acima do rodapé

  desenharTabelaRanking(
    doc,
    xColunaEsquerda,
    y,
    larguraColuna,
    'Top 10 empresas com mais pendências atrasadas',
    topEmpresas,
    alturaDisponivel,
  )
  desenharTabelaRanking(
    doc,
    xColunaDireita,
    y,
    larguraColuna,
    'Top 10 especialistas com mais pendências atrasadas',
    topEspecialistas,
    alturaDisponivel,
  )

  desenharRodape(doc, dataReferencia)

  doc.save(`relatorio-rdo-${chaveDataLocal(dataReferencia)}.pdf`)
}
