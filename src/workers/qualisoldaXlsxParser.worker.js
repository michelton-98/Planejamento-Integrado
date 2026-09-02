// Roda o parse dos arquivos .xlsx semanais da QUALISOLDA fora da thread
// principal (mesmo motivo do worker da FORTYS, ver fortysXmlParser.worker.js
// — evita travar a tela durante a leitura/soma de ~280-360 linhas por
// arquivo). Ver src/lib/qualisoldaXlsxWorkerClient.js (quem sobe este
// worker) e src/lib/qualisoldaXlsxParse.js (a lógica de extração em si).
import { parseQualisoldaXlsx } from '../lib/qualisoldaXlsxParse'

self.onmessage = async (event) => {
  const { arquivo, escopoTipo } = event.data
  try {
    const resultado = await parseQualisoldaXlsx(arquivo, escopoTipo)
    self.postMessage({ ok: true, resultado })
  } catch (err) {
    self.postMessage({ ok: false, erro: err?.message || 'Falha ao processar o arquivo .xlsx.' })
  }
}
