import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { datasOrdenadas, fetchTodoHistograma } from '../lib/histogramaData'
import Spinner from '../components/Spinner'
import HistogramaInput from '../components/histograma/HistogramaInput'
import HistogramaDashboard from '../components/histograma/HistogramaDashboard'

const ABAS = [
  { chave: 'input', rotulo: 'Input' },
  { chave: 'dashboard', rotulo: 'Dashboard' },
]

/**
 * Ferramenta "Histograma" (/histograma): efetivo de mão de obra (Previsto x
 * Realizado x Projeção) por Empresa/Disciplina/Data de referência — tabela
 * histograma_efetivo (ver migration 0023), independente do resto do
 * sistema. 2 abas (Input/Dashboard) sobre o mesmo estado em memória (todas
 * as datas já cadastradas), mesmo espírito de Validacoes.jsx/DestilariaFase1.jsx
 * — o fetch mora aqui, não nas abas.
 */
export default function Histograma() {
  const { user, profile } = useAuth()

  const [aba, setAba] = useState('input')
  const [linhasTodas, setLinhasTodas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)

    fetchTodoHistograma()
      .then((linhas) => {
        if (ativo) setLinhasTodas(linhas)
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
  }, [])

  const datasDisponiveis = useMemo(() => [...datasOrdenadas(linhasTodas)].reverse(), [linhasTodas])

  // Envio bem-sucedido substitui, em memória, o snapshot inteiro daquela
  // data (mesma coisa que aconteceu no banco — ver enviarHistogramaEfetivo)
  // sem precisar refazer o fetch completo.
  function handleEnviado(dataReferencia, novasLinhas) {
    setLinhasTodas((atual) => [...atual.filter((linha) => linha.data_referencia !== dataReferencia), ...novasLinhas])
  }

  return (
    <main className="flex-1 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-lg font-semibold text-navy dark:text-slate-100">Histograma</h1>
        <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">
          Efetivo de mão de obra por empresa e disciplina — Previsto × Realizado × Projeção, ao longo do tempo.
        </p>

        <div className="mb-4 flex gap-2 border-b border-gray-200 dark:border-slate-700">
          {ABAS.map((item) => (
            <button
              key={item.chave}
              type="button"
              onClick={() => setAba(item.chave)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                aba === item.chave
                  ? 'border-accent text-accent'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-navy dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100'
              }`}
            >
              {item.rotulo}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
            <Spinner className="h-4 w-4" />
            Carregando...
          </div>
        ) : error ? (
          <p className="text-sm text-alert">{error}</p>
        ) : aba === 'input' ? (
          <HistogramaInput
            linhasTodas={linhasTodas}
            datasDisponiveis={datasDisponiveis}
            user={user}
            profile={profile}
            onEnviado={handleEnviado}
          />
        ) : (
          <HistogramaDashboard linhasTodas={linhasTodas} />
        )}
      </div>
    </main>
  )
}
