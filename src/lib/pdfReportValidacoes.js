import { jsPDF } from 'jspdf'
import {
  CORES,
  MARGEM_X,
  carregarLogos,
  desenharCabecalho,
  desenharCardsIndicadores,
  desenharRodape,
  formatarDataBR,
  hexParaRgb,
} from './pdfShared'

const RODAPE_RESERVA = 34 // pt de folga acima do rodapé, mesma folga usada no relatório de RDO
const TOPO_NOVA_PAGINA = 50
const PADDING_CELULA_H = 6 // padding horizontal (esquerda/direita) dentro de cada célula
const PADDING_CELULA_V = 3 // padding vertical (topo/base) dentro de cada célula

// dataISO 'YYYY-MM-DD' -> 'DD/MM/AAAA', sem passar por `new Date()` (que
// interpretaria como UTC e poderia voltar um dia) — mesma lógica de
// ValidacoesDataBase.jsx/ValidacoesDashboard.jsx.
function formatarDataISOBr(dataISO) {
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

function chaveArquivo(dataISO) {
  return dataISO
}

// Altura ocupada por cada linha de texto quebrado dentro de uma célula —
// um pouco mais que o tamanho da fonte, pra dar espaçamento (leading)
// confortável entre linhas consecutivas.
function alturaPorLinhaDeTexto(fonteLinha) {
  return fonteLinha * 1.15
}

/** Quebra o texto de uma célula na largura real da coluna (splitTextToSize). */
function quebrarTextoColuna(doc, valor, coluna, fonteLinha) {
  const larguraDisponivel = coluna.largura - PADDING_CELULA_H * 2
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(fonteLinha)
  return doc.splitTextToSize(String(valor ?? '—'), larguraDisponivel)
}

// Desenha uma linha de texto já quebrada colocando em negrito o trecho
// "(CT xxxxx)", se ele aparecer nela — usado nas colunas que combinam
// nome da empresa/escopo com o número do contrato entre parênteses. jsPDF
// não faz negrito parcial numa única chamada de `text`, então desenha em
// 3 pedaços (antes/CT/depois) lado a lado, medindo a largura de cada um
// pra encaixar o próximo exatamente onde o anterior terminou.
function desenharLinhaComNegritoCT(doc, linha, x, yBase, fonteLinha, corHex) {
  doc.setFontSize(fonteLinha)
  doc.setTextColor(...hexParaRgb(corHex))

  const match = linha.match(/^(.*?)(\(CT [^)]*\))(.*)$/)
  if (!match) {
    doc.setFont('helvetica', 'normal')
    doc.text(linha, x, yBase)
    return
  }

  const [, antes, ct, depois] = match
  let cx = x
  if (antes) {
    doc.setFont('helvetica', 'normal')
    doc.text(antes, cx, yBase)
    cx += doc.getTextWidth(antes)
  }
  doc.setFont('helvetica', 'bold')
  doc.text(ct, cx, yBase)
  cx += doc.getTextWidth(ct)
  if (depois) {
    doc.setFont('helvetica', 'normal')
    doc.text(depois, cx, yBase)
  }
}

/**
 * Tabela genérica com cabeçalho colorido, zebra e paginação automática
 * (repete o cabeçalho em cada página nova, sempre respeitando a reserva de
 * espaço do rodapé). `colunas`: [{ titulo, largura, alinhar?, cor?(valor),
 * negritoCT? }]. `linhas`: array de arrays de string, uma célula por
 * coluna. Retorna o Y logo abaixo da última linha desenhada.
 *
 * Cada célula tem seu texto quebrado (`splitTextToSize`) na largura real
 * da própria coluna; a altura da linha da tabela é definida pelo maior
 * número de linhas entre TODAS as colunas daquela linha (nunca uma altura
 * fixa) — texto longo em qualquer coluna (Empresa, Escopo, Consideração...)
 * empurra a linha inteira pra baixo, evitando corte/sobreposição com a
 * linha seguinte. Texto sempre alinhado ao topo da célula, pra não ficar
 * estranho quando colunas da mesma linha quebram em números diferentes de
 * linhas de texto.
 */
function desenharTabela(doc, { x, y, colunas, linhas, fonteLinha = 8.5, alturaLinha = 16 }) {
  const larguraTotal = colunas.reduce((soma, coluna) => soma + coluna.largura, 0)
  const pageHeight = doc.internal.pageSize.getHeight()
  const alturaCabecalho = 18
  const alturaTextoLinha = alturaPorLinhaDeTexto(fonteLinha)

  function posicaoTexto(coluna, cx) {
    const align = coluna.alinhar ?? 'left'
    if (align === 'right') return { tx: cx + coluna.largura - PADDING_CELULA_H, align }
    if (align === 'center') return { tx: cx + coluna.largura / 2, align }
    return { tx: cx + PADDING_CELULA_H, align }
  }

  function desenharCabecalhoTabela(yTopo) {
    doc.setFillColor(...hexParaRgb(CORES.accent))
    doc.rect(x, yTopo, larguraTotal, alturaCabecalho, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(255, 255, 255)
    let cx = x
    colunas.forEach((coluna) => {
      const { tx, align } = posicaoTexto(coluna, cx)
      doc.text(coluna.titulo.toUpperCase(), tx, yTopo + alturaCabecalho - 6, { align })
      cx += coluna.largura
    })
    return yTopo + alturaCabecalho
  }

  let yAtual = desenharCabecalhoTabela(y)

  if (linhas.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...hexParaRgb(CORES.cinzaTexto))
    doc.text('Nenhum escopo ativo cadastrado.', x + PADDING_CELULA_H, yAtual + 14)
    return yAtual + 24
  }

  linhas.forEach((linha, indice) => {
    // 1) quebra o texto de cada coluna na largura real dela e usa o maior
    // número de linhas resultante pra definir a altura desta linha.
    const linhasPorColuna = colunas.map((coluna, colIndice) => quebrarTextoColuna(doc, linha[colIndice], coluna, fonteLinha))
    const maxLinhasTexto = Math.max(1, ...linhasPorColuna.map((textoQuebrado) => textoQuebrado.length))
    const alturaCalculada = maxLinhasTexto * alturaTextoLinha + PADDING_CELULA_V * 2
    const alturaLinhaAtual = Math.max(alturaLinha, alturaCalculada)

    if (yAtual + alturaLinhaAtual > pageHeight - RODAPE_RESERVA) {
      doc.addPage()
      yAtual = desenharCabecalhoTabela(TOPO_NOVA_PAGINA)
    }

    if (indice % 2 === 1) {
      doc.setFillColor(...hexParaRgb(CORES.cinzaClaro))
      doc.rect(x, yAtual, larguraTotal, alturaLinhaAtual, 'F')
    }

    let cx = x
    colunas.forEach((coluna, colIndice) => {
      const { tx, align } = posicaoTexto(coluna, cx)
      const cor = coluna.cor ? coluna.cor(linha[colIndice]) : CORES.navy

      linhasPorColuna[colIndice].forEach((textoLinha, indiceLinhaTexto) => {
        const yBase = yAtual + PADDING_CELULA_V + fonteLinha + indiceLinhaTexto * alturaTextoLinha
        if (coluna.negritoCT && align === 'left') {
          desenharLinhaComNegritoCT(doc, textoLinha, tx, yBase, fonteLinha, cor)
        } else {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(fonteLinha)
          doc.setTextColor(...hexParaRgb(cor))
          doc.text(textoLinha, tx, yBase, { align })
        }
      })

      cx += coluna.largura
    })

    yAtual += alturaLinhaAtual
  })

  return yAtual
}

function desenharTituloSecao(doc, x, y, texto) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...hexParaRgb(CORES.navy))
  doc.text(texto, x, y)
  return y + 16
}

function corSimNao(valor) {
  if (valor === 'Sim') return CORES.success
  if (valor === 'Não') return CORES.alert
  return CORES.cinzaTexto
}

/** Fecha todas as páginas já desenhadas com o rodapé padrão "Página X de Y". */
function desenharRodapeEmTodasPaginas(doc, textoReferencia) {
  const totalPaginas = doc.internal.getNumberOfPages()
  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    doc.setPage(pagina)
    desenharRodape(doc, textoReferencia, `Página ${pagina} de ${totalPaginas}`)
  }
}

/**
 * Gera e baixa o PDF do relatório SEMANAL de validações: cabeçalho padrão,
 * cards de indicadores (mesma lógica de computeValidacoesStatsSemana já
 * usada no Dashboard), lista "Escopos por consideração" e a tabela
 * detalhada — uma linha por escopo ATIVO, com o registro de
 * data_recebimento exata na data de referência (ou "—"/"Sem registro" pros
 * que não têm lançamento nessa data).
 */
export async function gerarRelatorioValidacoesSemanalPdf({ dataReferencia, stats, detalhes }) {
  const logos = await carregarLogos()

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const larguraUtil = pageWidth - MARGEM_X * 2
  const gap = 12

  let y = desenharCabecalho(doc, {
    logos,
    titulo: 'Controle de Validações',
    subtitulo: `Relatório Semanal de Validações   ·   Data de referência: ${formatarDataISOBr(dataReferencia)}`,
  })

  const indicadores = [
    { label: 'Escopos ativos', valor: stats.totalEscoposAtivos, cor: CORES.navy },
    { label: 'Validação completa', valor: stats.completos, cor: CORES.success },
    { label: 'Validação em Andamento', valor: stats.incompletos, cor: CORES.accent },
    { label: 'Sem registro nesta data', valor: stats.semRegistro, cor: CORES.alert },
  ]
  const alturaCard = desenharCardsIndicadores(doc, MARGEM_X, y, larguraUtil, indicadores, { gap })
  y += alturaCard + 26

  // --- Escopos por consideração -----------------------------------------
  y = desenharTituloSecao(doc, MARGEM_X, y, 'Escopos por consideração')
  const linhasConsideracao = [
    ...stats.porConsideracao.map((item) => [item.valor, String(item.total)]),
    ['Sem registro nesta data', String(stats.semRegistro)],
  ]
  y = desenharTabela(doc, {
    x: MARGEM_X,
    y,
    colunas: [
      { titulo: 'Consideração', largura: larguraUtil - 90 },
      { titulo: 'Total', largura: 90, alinhar: 'right' },
    ],
    linhas: linhasConsideracao,
  })
  y += 26

  // --- Detalhamento por escopo --------------------------------------------
  y = desenharTituloSecao(doc, MARGEM_X, y, 'Detalhamento por escopo')
  const colunasDetalhe = [
    { titulo: 'Empresa', largura: 115, negritoCT: true },
    { titulo: 'Escopo', largura: 115 },
    { titulo: 'Planejamento', largura: 68, alinhar: 'center', cor: corSimNao },
    { titulo: 'Especialista', largura: 68, alinhar: 'center', cor: corSimNao },
    { titulo: 'Sharepoint', largura: 68, alinhar: 'center', cor: corSimNao },
    { titulo: 'Consideração', largura: larguraUtil - 115 - 115 - 68 * 3 },
  ]
  const linhasDetalhe = detalhes.map(({ escopo, registro }) => [
    escopo.numero_contrato ? `${escopo.empresa} (CT ${escopo.numero_contrato})` : escopo.empresa,
    escopo.escopo,
    registro ? (registro.validado_planejamento ? 'Sim' : 'Não') : '—',
    registro ? (registro.validado_especialista ? 'Sim' : 'Não') : '—',
    registro ? (registro.sharepoint ? 'Sim' : 'Não') : '—',
    registro ? registro.consideracao : 'Sem registro',
  ])
  desenharTabela(doc, { x: MARGEM_X, y, colunas: colunasDetalhe, linhas: linhasDetalhe })

  desenharRodapeEmTodasPaginas(doc, `Referente à semana de ${formatarDataISOBr(dataReferencia)}`)

  doc.save(`relatorio-validacoes-semanal-${chaveArquivo(dataReferencia)}.pdf`)
}

/**
 * Gera e baixa o PDF do relatório MENSAL de validações: cabeçalho padrão,
 * cards de indicadores agregados do período (ver resumoMatrizPeriodo) e a
 * mesma grade escopo × quarta-feira do Dashboard modo Mensal, formatada
 * pra impressão (fonte menor pra caber todas as colunas).
 */
export async function gerarRelatorioValidacoesMensalPdf({ inicioPeriodo, fimPeriodo, quartas, linhas, resumo }) {
  const logos = await carregarLogos()

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const larguraUtil = pageWidth - MARGEM_X * 2
  const gap = 12

  let y = desenharCabecalho(doc, {
    logos,
    titulo: 'Controle de Validações',
    subtitulo: `Relatório Mensal de Validações   ·   Período: ${formatarDataISOBr(inicioPeriodo)} – ${formatarDataISOBr(fimPeriodo)}`,
  })

  const indicadores = [
    { label: 'Escopos ativos', valor: resumo.totalEscoposAtivos, cor: CORES.navy },
    { label: 'Semanas no período', valor: quartas.length, cor: CORES.navy },
    { label: 'Cronograma Validado', valor: resumo.validadas, cor: CORES.success },
    { label: 'Não Validado / Reprovado', valor: resumo.naoValidadas, cor: CORES.alert },
  ]
  const alturaCard = desenharCardsIndicadores(doc, MARGEM_X, y, larguraUtil, indicadores, { gap })
  y += alturaCard + 26

  y = desenharTituloSecao(doc, MARGEM_X, y, 'Cronograma por escopo')

  const larguraEscopo = 170
  const larguraColunaData = (larguraUtil - larguraEscopo) / Math.max(quartas.length, 1)
  const colunas = [
    { titulo: 'Escopo', largura: larguraEscopo, negritoCT: true },
    ...quartas.map((data) => ({
      titulo: formatarDataISOBr(data).slice(0, 5), // DD/MM
      largura: larguraColunaData,
      alinhar: 'center',
      cor: (valor) => (valor === 'Validado' ? CORES.success : valor === '—' ? CORES.cinzaTexto : CORES.alert),
    })),
  ]
  const linhasTabela = linhas.map(({ escopo, celulas }) => [
    escopo.numero_contrato
      ? `${escopo.empresa} (CT ${escopo.numero_contrato}) — ${escopo.escopo}`
      : `${escopo.empresa} — ${escopo.escopo}`,
    ...celulas.map((celula) => (celula.registro ? (celula.validado ? 'Validado' : 'Não Validado') : '—')),
  ])

  desenharTabela(doc, {
    x: MARGEM_X,
    y,
    colunas,
    linhas: linhasTabela,
    fonteLinha: 7,
    alturaLinha: 15,
  })

  desenharRodapeEmTodasPaginas(
    doc,
    `Referente ao período de ${formatarDataISOBr(inicioPeriodo)} a ${formatarDataISOBr(fimPeriodo)}`,
  )

  doc.save(`relatorio-validacoes-mensal-${chaveArquivo(inicioPeriodo)}_${chaveArquivo(fimPeriodo)}.pdf`)
}
