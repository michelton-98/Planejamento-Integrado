import { useRef, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { parseRdoFile } from '../lib/rdoImportParser'
import Spinner from '../components/Spinner'
import Card from '../components/Card'
import ObrasEscoposImport from '../components/input/ObrasEscoposImport'
import ObrasEscoposTable from '../components/input/ObrasEscoposTable'
import RdosSemObra from '../components/input/RdosSemObra'

export default function Input() {
  const { user } = useAuth()
  const fileInputRef = useRef(null)

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [parseError, setParseError] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState(null)
  // A importação substitui TODO o conteúdo de rdo_relatorios (o arquivo é
  // sempre o snapshot completo das pendências, não incremental) — é uma
  // ação destrutiva, então exige uma confirmação explícita antes de
  // executar. `confirmando` controla essa segunda etapa.
  const [confirmando, setConfirmando] = useState(false)

  // Compartilhados entre RdosSemObra e ObrasEscoposTable: `refreshToken`
  // faz RdosSemObra recalcular a lista sempre que uma obra é criada/editada
  // (ou um lote de RDOs é importado); `prefillObra` é o atalho "+
  // Cadastrar esta obra" pré-preenchendo o formulário de nova obra.
  const [refreshToken, setRefreshToken] = useState(0)
  const [prefillObra, setPrefillObra] = useState(null)

  const ocupado = parsing || submitting
  const validRows = rows.filter((row) => row.erros.length === 0)
  const invalidRows = rows.filter((row) => row.erros.length > 0)

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setRows([])
    setParseError(null)
    setSubmitMessage(null)
    setConfirmando(false)
    setParsing(true)

    try {
      const parsed = await parseRdoFile(file)
      setRows(parsed)
    } catch (error) {
      setParseError(error.message)
    } finally {
      setParsing(false)
    }
  }

  function handlePedirConfirmacao() {
    if (!validRows.length) return
    setSubmitMessage(null)
    setConfirmando(true)
  }

  async function handleConfirmarSubstituicao() {
    if (!validRows.length) return

    setSubmitting(true)
    setSubmitMessage(null)

    // O arquivo importado é o snapshot completo das pendências (não
    // incremental) — apaga TUDO em rdo_relatorios antes de inserir as
    // linhas novas. Nunca toca em obras_escopos.
    const { error: erroDelete } = await supabase.from('rdo_relatorios').delete().not('id', 'is', null)

    if (erroDelete) {
      setSubmitting(false)
      setConfirmando(false)
      setSubmitMessage({ type: 'error', text: `Erro ao apagar dados atuais: ${erroDelete.message}` })
      return
    }

    // Confirma que a exclusão realmente aconteceu antes de inserir — sob
    // RLS, um DELETE sem permissão não dá erro, só apaga 0 linhas. Sem
    // essa checagem, isso voltaria a se comportar como "soma" em silêncio.
    const { count, error: erroContagem } = await supabase
      .from('rdo_relatorios')
      .select('id', { count: 'exact', head: true })

    if (erroContagem || (count ?? 0) > 0) {
      setSubmitting(false)
      setConfirmando(false)
      setSubmitMessage({
        type: 'error',
        text:
          'Não foi possível apagar os dados existentes (verifique se a migration de permissão ' +
          'de exclusão foi aplicada no Supabase). Nenhum dado foi importado.',
      })
      return
    }

    const payload = validRows.map((row) => ({
      data_relatorio: row.data_relatorio,
      numero_rdo: row.numero_rdo,
      empresa: row.empresa,
      escopo: row.escopo,
      numero_contrato: row.numero_contrato,
      status_aprovacao: row.status_aprovacao,
      responsavel_nome: row.responsavel_nome,
      responsavel_email: row.responsavel_email,
      usuario_id: user.id,
    }))

    const { error } = await supabase.from('rdo_relatorios').insert(payload)

    setSubmitting(false)
    setConfirmando(false)

    if (error) {
      setSubmitMessage({
        type: 'error',
        text: `Os dados antigos foram apagados, mas houve erro ao importar os novos: ${error.message}`,
      })
      return
    }

    setSubmitMessage({
      type: 'success',
      text: `Dados substituídos: ${payload.length} relatório(s) importado(s).`,
    })
    setRows([])
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    setRefreshToken((atual) => atual + 1)
  }

  return (
    <main className="flex-1 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-6 text-lg font-semibold text-navy">Importar RDOs</h2>

        <Card faixaCor="#12263f" categoria="Importação" className="mb-6" contentClassName="p-4">
          <label htmlFor="arquivo" className="mb-1 block text-sm font-medium text-gray-700">
            Arquivo .csv ou .xlsx (máx. 15 MB)
          </label>
          <input
            id="arquivo"
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFileChange}
            disabled={ocupado}
            className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {fileName && (
            <p className="mt-2 text-sm text-gray-500">Arquivo selecionado: {fileName}</p>
          )}
        </Card>

        {parsing && (
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
            <Spinner className="h-4 w-4 text-accent" />
            Processando arquivo...
          </div>
        )}

        {parseError && (
          <p className="mb-4 whitespace-pre-line text-sm text-alert">{parseError}</p>
        )}

        {rows.length > 0 && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-600">
                {rows.length} linha(s) lida(s) — {validRows.length} válida(s),{' '}
                {invalidRows.length} com erro
                {invalidRows.length !== 1 ? 's' : ''}.
              </p>
              <button
                type="button"
                disabled={!validRows.length || submitting}
                onClick={handlePedirConfirmacao}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {submitting && <Spinner className="h-4 w-4 text-white" />}
                {submitting
                  ? 'Enviando...'
                  : `Confirmar envio de ${validRows.length} registro(s)`}
              </button>
            </div>

            {confirmando && (
              <div className="mb-4 rounded-xl border border-alert/30 bg-alert/5 p-4">
                <p className="mb-3 text-sm font-medium text-alert">
                  Isso vai apagar TODOS os RDOs pendentes atualmente na base e substituir pelos{' '}
                  {validRows.length} registro(s) deste arquivo. Essa ação não pode ser desfeita.
                  Confirmar?
                </p>
                <p className="mb-3 text-xs text-gray-500">
                  A tabela "Escopos - Rondonópolis" (obras cadastradas) não é afetada.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleConfirmarSubstituicao}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-md bg-alert px-4 py-2 text-sm font-medium text-white hover:bg-alert/90 disabled:opacity-50"
                  >
                    {submitting && <Spinner className="h-4 w-4 text-white" />}
                    {submitting ? 'Substituindo...' : 'Sim, substituir tudo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    disabled={submitting}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

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
                      Status aprovação
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Responsável</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">E-mail</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Data</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Nº RDO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {rows.map((row) => (
                    <tr key={row.linha} className={row.erros.length ? 'bg-red-50' : undefined}>
                      <td className="px-3 py-2 text-gray-500">{row.linha}</td>
                      <td className="px-3 py-2 text-navy">{row.empresa}</td>
                      <td className="px-3 py-2 text-navy">{row.escopo}</td>
                      <td className="px-3 py-2 text-navy">{row.numero_contrato ?? '—'}</td>
                      <td className="px-3 py-2 text-navy">{row.status_aprovacao ?? '—'}</td>
                      <td className="px-3 py-2 text-navy">{row.responsavel_nome}</td>
                      <td className="px-3 py-2 text-navy">{row.responsavel_email}</td>
                      <td className="px-3 py-2 text-navy">{row.data_relatorio ?? '—'}</td>
                      <td className="px-3 py-2 text-navy">{row.numero_rdo ?? '—'}</td>
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
                      Linha {row.linha}: {row.erros.join(' ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <RdosSemObra refreshToken={refreshToken} onSolicitarCadastro={setPrefillObra} />

        <div className="my-10 border-t border-gray-200" />

        <ObrasEscoposImport onImportado={() => setRefreshToken((atual) => atual + 1)} />
        <ObrasEscoposTable
          prefill={prefillObra}
          onPrefillConsumido={() => setPrefillObra(null)}
          onMudanca={() => setRefreshToken((atual) => atual + 1)}
        />
      </div>
    </main>
  )
}
