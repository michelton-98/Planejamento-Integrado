import { useEffect, useState } from 'react'
import { fetchRdoRelatorios } from '../../lib/dashboardData'
import { fetchObrasEscopos } from '../../lib/obrasEscoposData'
import { agruparRdosSemObra } from '../../lib/obraMatching'
import Spinner from '../Spinner'
import Card from '../Card'

/**
 * Indicador de RDOs (já existentes na base, não só os do arquivo recém
 * importado) cuja obra não está cadastrada em obras_escopos — mesma regra
 * de correspondência usada no filtro do dashboard (numero_contrato, senão
 * empresa+escopo). `refreshToken` força um refetch quando muda (ex.: após
 * o admin cadastrar uma obra pela tabela abaixo). `onSolicitarCadastro`
 * é o atalho "+ Cadastrar esta obra": repassa os dados pro formulário de
 * nova obra em ObrasEscoposTable.jsx via Input.jsx.
 */
export default function RdosSemObra({ refreshToken, onSolicitarCadastro }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [itens, setItens] = useState([])
  const [expandido, setExpandido] = useState(false)

  useEffect(() => {
    let ativo = true
    setLoading(true)

    Promise.all([fetchRdoRelatorios(), fetchObrasEscopos()])
      .then(([rdos, obras]) => {
        if (!ativo) return
        setItens(agruparRdosSemObra(rdos, obras))
      })
      .catch((err) => {
        if (ativo) setError(err.message)
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [refreshToken])

  if (loading) {
    return (
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Spinner className="h-4 w-4 text-accent" />
        Verificando RDOs sem obra cadastrada...
      </div>
    )
  }

  if (error) {
    return <p className="mb-6 text-sm text-alert">{error}</p>
  }

  if (itens.length === 0) {
    return (
      <p className="mb-6 text-sm text-success">
        Todos os RDOs têm uma obra correspondente cadastrada em Escopos - Rondonópolis.
      </p>
    )
  }

  const totalRdos = itens.reduce((soma, item) => soma + item.total, 0)

  return (
    <Card faixaCor="#d1495b" categoria="Atenção" className="mb-6">
      <button
        type="button"
        onClick={() => setExpandido((atual) => !atual)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <span className="text-sm font-medium text-navy">
          <span className="mr-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-alert px-2 py-0.5 text-xs font-semibold text-white">
            {itens.length}
          </span>
          obra(s) sem cadastro em Escopos - Rondonópolis ({totalRdos} RDO(s) afetado(s))
        </span>
        <span className="text-xs font-medium text-accent">{expandido ? 'Ocultar' : 'Ver lista'}</span>
      </button>

      {expandido && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Empresa</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Escopo</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Contrato</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">RDOs</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {itens.map((item, indice) => (
                <tr key={indice}>
                  <td className="px-3 py-2 text-navy">{item.empresa || '—'}</td>
                  <td className="px-3 py-2 text-navy">{item.escopo || '—'}</td>
                  <td className="px-3 py-2 text-navy">{item.numero_contrato ?? '—'}</td>
                  <td className="px-3 py-2 text-navy">{item.total}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onSolicitarCadastro?.(item)}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      + Cadastrar esta obra
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
