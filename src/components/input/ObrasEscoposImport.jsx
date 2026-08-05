import { useRef, useState } from 'react'
import { parseObrasEscoposFile } from '../../lib/obrasEscoposParser'
import { aplicarImportacaoObras } from '../../lib/obrasEscoposData'
import Spinner from '../Spinner'
import Card from '../Card'

export default function ObrasEscoposImport({ onImportado }) {
  const fileInputRef = useRef(null)

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [parseError, setParseError] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState(null)

  const ocupado = parsing || submitting
  const validRows = rows.filter((row) => !row.erro)
  const invalidRows = rows.filter((row) => row.erro)
  const linhasParaRevisar = validRows.filter((row) => !row.statusReconhecido)

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setRows([])
    setParseError(null)
    setSubmitMessage(null)
    setParsing(true)

    try {
      const parsed = await parseObrasEscoposFile(file)
      setRows(parsed)
    } catch (error) {
      setParseError(error.message)
    } finally {
      setParsing(false)
    }
  }

  async function handleConfirmar() {
    if (!validRows.length) return

    setSubmitting(true)
    setSubmitMessage(null)

    try {
      const { criadas, atualizadas } = await aplicarImportacaoObras(validRows)
      setSubmitMessage({
        type: 'success',
        text: `${criadas} obra(s) criada(s), ${atualizadas} atualizada(s).`,
      })
      setRows([])
      setFileName('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      onImportado?.()
    } catch (error) {
      setSubmitMessage({ type: 'error', text: error.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h3 className="mb-4 text-base font-semibold text-navy">Escopos - Rondonópolis</h3>

      <Card faixaCor="#12263f" categoria="Importação" className="mb-6" contentClassName="p-4">
        <label htmlFor="arquivo-obras" className="mb-1 block text-sm font-medium text-gray-700">
          Planilha .xlsx com as colunas "Obra" e "Status" (máx. 15 MB)
        </label>
        <input
          id="arquivo-obras"
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileChange}
          disabled={ocupado}
          className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {fileName && <p className="mt-2 text-sm text-gray-500">Arquivo selecionado: {fileName}</p>}
      </Card>

      {parsing && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <Spinner className="h-4 w-4 text-accent" />
          Processando arquivo...
        </div>
      )}

      {parseError && <p className="mb-4 whitespace-pre-line text-sm text-alert">{parseError}</p>}

      {rows.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              {rows.length} linha(s) lida(s) — {validRows.length} válida(s),{' '}
              {invalidRows.length} com erro{invalidRows.length !== 1 ? 's' : ''}
              {linhasParaRevisar.length > 0 &&
                `, ${linhasParaRevisar.length} com status não reconhecido (revisar)`}
              .
            </p>
            <button
              type="button"
              disabled={!validRows.length || submitting}
              onClick={handleConfirmar}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {submitting && <Spinner className="h-4 w-4 text-white" />}
              {submitting
                ? 'Enviando...'
                : `Confirmar importação de ${validRows.length} registro(s)`}
            </button>
          </div>

          {submitMessage && (
            <p
              className={`mb-4 text-sm ${
                submitMessage.type === 'error' ? 'text-alert' : 'text-success'
              }`}
            >
              {submitMessage.text}
            </p>
          )}

          <Card
            faixaCor="#2f6fed"
            categoria="Pré-visualização"
            className="mb-4"
            contentClassName="overflow-x-auto"
          >
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Linha</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Empresa</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Escopo</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Contrato</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">
                    Status detectado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {rows.map((row) => (
                  <tr
                    key={row.linha}
                    className={
                      row.erro
                        ? 'bg-red-50'
                        : !row.statusReconhecido
                          ? 'bg-amber-50'
                          : undefined
                    }
                  >
                    <td className="px-3 py-2 text-gray-500">{row.linha}</td>
                    <td className="px-3 py-2 text-navy">{row.empresa}</td>
                    <td className="px-3 py-2 text-navy">{row.escopo}</td>
                    <td className="px-3 py-2 text-navy">{row.numero_contrato ?? '—'}</td>
                    <td className="px-3 py-2 text-navy">
                      {row.status}
                      {!row.erro && !row.statusReconhecido && (
                        <span className="ml-2 text-xs text-amber-700">
                          (status "{row.statusOriginal}" não reconhecido — revisar)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {invalidRows.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="mb-2 font-medium">Linhas com erro (não serão enviadas):</p>
              <ul className="list-disc space-y-1 pl-5">
                {invalidRows.map((row) => (
                  <li key={row.linha}>
                    Linha {row.linha}: {row.erro}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
