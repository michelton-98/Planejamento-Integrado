// Sobe o Web Worker de parse do XML da FORTYS (ver
// src/workers/fortysXmlParser.worker.js) e devolve uma Promise — isola a
// API de Worker (postMessage/onmessage/terminate) do resto do código, que
// só quer um `await processarXmlFortys(arquivo)` simples. Ver AvancoInput.jsx.
export function processarXmlFortys(arquivo) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/fortysXmlParser.worker.js', import.meta.url), { type: 'module' })

    worker.onmessage = (event) => {
      worker.terminate()
      if (event.data.ok) resolve(event.data.resultado)
      else reject(new Error(event.data.erro))
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || 'Falha ao processar o arquivo .xml.'))
    }

    worker.postMessage(arquivo)
  })
}
