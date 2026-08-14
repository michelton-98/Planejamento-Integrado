import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { DISCIPLINAS_AVANCO } from '../../lib/avancoIntegradoConfig'
import { fetchAvancoArquivos, salvarDisciplinasDashboard } from '../../lib/avancoIntegradoData'
import Spinner from '../../components/Spinner'
import AvancoDashboard from '../../components/avanco/AvancoDashboard'
import AvancoDataBase from '../../components/avanco/AvancoDataBase'
import AvancoInput from '../../components/avanco/AvancoInput'

const FASE = 'destilaria_fase_1'

const ABAS = [
  { chave: 'dashboard', rotulo: 'Dashboard' },
  { chave: 'dados', rotulo: 'Data_Base' },
  { chave: 'input', rotulo: 'Input' },
]

/**
 * Ferramenta "Destilaria Fase I" (/avanco-integrado/destilaria-fase-1): 3
 * abas sobre a mesma tabela avanco_arquivos (ver migration 0016), filtrada
 * por fase = 'destilaria_fase_1'. O fetch e as mutações moram aqui (não
 * nas abas), mesmo espírito do Validacoes.jsx — todas as abas sempre veem
 * o mesmo estado em memória, sem refetch ao trocar de aba.
 */
export default function DestilariaFase1() {
  const { user, profile, refreshProfile } = useAuth()

  const [aba, setAba] = useState('dashboard')
  const [arquivos, setArquivos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filtro de disciplinas do Dashboard: nulo/ausente no perfil = "todas
  // marcadas" (primeiro acesso e padrão histórico, ver migration 0018).
  // Guardado em estado local pra resposta imediata do checkbox; persistido
  // no perfil (salvarDisciplinasDashboard) a cada alteração, sincronizado
  // entre qualquer computador que o usuário use pra entrar no sistema.
  const [disciplinasSelecionadas, setDisciplinasSelecionadas] = useState(DISCIPLINAS_AVANCO)
  const [salvandoDisciplinas, setSalvandoDisciplinas] = useState(false)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)

    fetchAvancoArquivos(FASE)
      .then((lista) => {
        if (ativo) setArquivos(lista)
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

  // Reflete o filtro salvo no perfil sempre que ele mudar (login em outro
  // computador, refreshProfile após salvar aqui mesmo etc.).
  useEffect(() => {
    setDisciplinasSelecionadas(profile?.avanco_dashboard_disciplinas ?? DISCIPLINAS_AVANCO)
  }, [profile?.avanco_dashboard_disciplinas])

  async function handleAlterarDisciplinas(novaLista) {
    // "Todas marcadas" grava null no perfil (ver salvarDisciplinasDashboard)
    // pra disciplinas futuras entrarem automaticamente selecionadas.
    const paraSalvar = novaLista.length === DISCIPLINAS_AVANCO.length ? null : novaLista
    const anterior = disciplinasSelecionadas
    setDisciplinasSelecionadas(novaLista)
    setSalvandoDisciplinas(true)
    try {
      await salvarDisciplinasDashboard(paraSalvar)
      await refreshProfile()
    } catch (err) {
      setDisciplinasSelecionadas(anterior)
      setError(err.message)
    } finally {
      setSalvandoDisciplinas(false)
    }
  }

  function handleArquivoEnviado(registro) {
    setArquivos((atual) => {
      const existe = atual.some((item) => item.id === registro.id)
      return existe ? atual.map((item) => (item.id === registro.id ? registro : item)) : [registro, ...atual]
    })
  }

  return (
    <main className="flex-1 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-lg font-semibold text-navy dark:text-slate-100">Destilaria Fase I</h1>
        <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">
          Avanço físico por disciplina e empresa — envio de arquivos e indicadores de cobertura.
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
        ) : aba === 'dashboard' ? (
          <AvancoDashboard
            fase={FASE}
            arquivos={arquivos}
            disciplinasSelecionadas={disciplinasSelecionadas}
            onAlterarDisciplinas={handleAlterarDisciplinas}
            salvando={salvandoDisciplinas}
          />
        ) : aba === 'dados' ? (
          <AvancoDataBase fase={FASE} arquivos={arquivos} />
        ) : (
          <AvancoInput fase={FASE} arquivos={arquivos} user={user} profile={profile} onArquivoEnviado={handleArquivoEnviado} />
        )}
      </div>
    </main>
  )
}
