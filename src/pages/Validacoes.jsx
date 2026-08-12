import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import {
  agruparSemanaisPorEscopo,
  atualizarValidacaoEscopo,
  atualizarValidacaoSemanal,
  fetchTodasValidacoesSemanais,
  fetchValidacoesEscopos,
  inserirValidacaoEscopo,
  inserirValidacaoSemanal,
  removerValidacaoEscopo,
  removerValidacaoSemanal,
} from '../lib/validacoesData'
import Spinner from '../components/Spinner'
import ValidacoesDataBase from '../components/validacoes/ValidacoesDataBase'
import ValidacoesDashboard from '../components/validacoes/ValidacoesDashboard'

const ABAS = [
  { chave: 'dados', rotulo: 'Data_Base' },
  { chave: 'dashboard', rotulo: 'Dashboard' },
]

/**
 * Ferramenta "Controle de Validações" (/validacoes): 2 abas internas
 * (Data_Base / Dashboard) sobre as mesmas duas tabelas, totalmente
 * independentes de obras_escopos/rdo_relatorios do Controle de RDO — ver
 * migration 0010. O fetch e as mutações moram aqui (não nas abas) pra
 * ambas sempre lerem o mesmo estado em memória.
 */
export default function Validacoes() {
  const { user, profile } = useAuth()

  const [aba, setAba] = useState('dados')
  const [escopos, setEscopos] = useState([])
  const [semanaisPorEscopo, setSemanaisPorEscopo] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)

    Promise.all([fetchValidacoesEscopos(), fetchTodasValidacoesSemanais()])
      .then(([listaEscopos, listaSemanais]) => {
        if (!ativo) return
        setEscopos(listaEscopos)
        setSemanaisPorEscopo(agruparSemanaisPorEscopo(listaSemanais))
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

  async function handleAdicionarEscopo(payload) {
    const novo = await inserirValidacaoEscopo(payload)
    setEscopos((atual) => [...atual, novo])
  }

  async function handleAtualizarEscopo(id, patch) {
    const atualizado = await atualizarValidacaoEscopo(id, patch)
    setEscopos((atual) => atual.map((escopo) => (escopo.id === id ? atualizado : escopo)))
  }

  async function handleRemoverEscopo(id) {
    await removerValidacaoEscopo(id)
    setEscopos((atual) => atual.filter((escopo) => escopo.id !== id))
    setSemanaisPorEscopo((atual) => {
      const novo = new Map(atual)
      novo.delete(id)
      return novo
    })
  }

  async function handleAdicionarSemanal(escopoId, form) {
    const novo = await inserirValidacaoSemanal({
      escopo_id: escopoId,
      data_recebimento: form.data_recebimento,
      validado_planejamento: form.validado_planejamento,
      validado_especialista: form.validado_especialista,
      sharepoint: form.sharepoint,
      consideracao: form.consideracao,
      criado_por: user?.id ?? null,
      criado_por_nome: profile?.nome || null,
      criado_por_email: user?.email || null,
    })
    setSemanaisPorEscopo((atual) => {
      const novoMapa = new Map(atual)
      novoMapa.set(escopoId, [novo, ...(novoMapa.get(escopoId) ?? [])])
      return novoMapa
    })
  }

  async function handleEditarSemanal(escopoId, semanalId, form) {
    const atualizado = await atualizarValidacaoSemanal(semanalId, {
      data_recebimento: form.data_recebimento,
      validado_planejamento: form.validado_planejamento,
      validado_especialista: form.validado_especialista,
      sharepoint: form.sharepoint,
      consideracao: form.consideracao,
    })
    setSemanaisPorEscopo((atual) => {
      const novoMapa = new Map(atual)
      novoMapa.set(
        escopoId,
        (novoMapa.get(escopoId) ?? []).map((registro) => (registro.id === semanalId ? atualizado : registro)),
      )
      return novoMapa
    })
  }

  async function handleRemoverSemanal(escopoId, id) {
    await removerValidacaoSemanal(id)
    setSemanaisPorEscopo((atual) => {
      const novoMapa = new Map(atual)
      novoMapa.set(escopoId, (novoMapa.get(escopoId) ?? []).filter((registro) => registro.id !== id))
      return novoMapa
    })
  }

  return (
    <main className="flex-1 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-lg font-semibold text-navy">Controle de Validações</h1>
        <p className="mb-4 text-sm text-gray-500">
          Cadastro de escopos e histórico semanal de validação entre Planejamento, Especialista e Sharepoint.
        </p>

        <div className="mb-4 flex gap-2 border-b border-gray-200">
          {ABAS.map((item) => (
            <button
              key={item.chave}
              type="button"
              onClick={() => setAba(item.chave)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                aba === item.chave
                  ? 'border-accent text-accent'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-navy'
              }`}
            >
              {item.rotulo}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Spinner className="h-4 w-4" />
            Carregando...
          </div>
        ) : error ? (
          <p className="text-sm text-alert">{error}</p>
        ) : aba === 'dados' ? (
          <ValidacoesDataBase
            escopos={escopos}
            semanaisPorEscopo={semanaisPorEscopo}
            onAdicionarEscopo={handleAdicionarEscopo}
            onAtualizarEscopo={handleAtualizarEscopo}
            onRemoverEscopo={handleRemoverEscopo}
            onAdicionarSemanal={handleAdicionarSemanal}
            onEditarSemanal={handleEditarSemanal}
            onRemoverSemanal={handleRemoverSemanal}
          />
        ) : (
          <ValidacoesDashboard escopos={escopos} semanaisPorEscopo={semanaisPorEscopo} />
        )}
      </div>
    </main>
  )
}
