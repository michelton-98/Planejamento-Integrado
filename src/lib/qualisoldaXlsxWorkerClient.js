// Sobe o Web Worker de parse dos .xlsx da QUALISOLDA (ver
// src/workers/qualisoldaXlsxParser.worker.js) e devolve uma Promise — mesmo
// padrão de fortysXmlWorkerClient.js, isola a API de Worker do resto do
// código, que só quer um `await processarXlsxQualisolda(arquivo, 'carbono')`
// simples. Ver AvancoInput.jsx.
export function processarXlsxQualisolda(arquivo, escopoTipo) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/qualisoldaXlsxParser.worker.js', import.meta.url), { type: 'module' })

    worker.onmessage = (event) => {
      worker.terminate()
      if (event.data.ok) resolve(event.data.resultado)
      else reject(new Error(event.data.erro))
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || 'Falha ao processar o arquivo .xlsx.'))
    }

    worker.postMessage({ arquivo, escopoTipo })
  })
}
