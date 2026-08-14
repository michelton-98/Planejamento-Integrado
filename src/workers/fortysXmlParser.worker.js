// Roda o parse do cronograma FORTYS (.xml, MS Project) fora da thread
// principal — arquivos reais passam de 90 MB, o parse (DOMParser + varredura
// das tarefas) travaria a tela por vários segundos se rodasse no main
// thread. Ver src/lib/fortysXmlWorkerClient.js (quem sobe este worker) e
// src/lib/fortysXmlParse.js (a lógica de extração em si, sem dependência
// de Worker — só usa DOMParser/File, disponíveis aqui também).
import { parseFortysXml } from '../lib/fortysXmlParse'

self.onmessage = async (event) => {
  try {
    const resultado = await parseFortysXml(event.data)
    self.postMessage({ ok: true, resultado })
  } catch (err) {
    self.postMessage({ ok: false, erro: err?.message || 'Falha ao processar o arquivo .xml.' })
  }
}
