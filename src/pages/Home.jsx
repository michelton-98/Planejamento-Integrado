import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import ToolCard from '../components/ToolCard'
import { FERRAMENTAS } from '../lib/ferramentas'

// "Michel Guimarães Ribeiro" -> "MG" (primeira letra do primeiro e do
// último nome); sem nome cadastrado, cai pra primeira letra do e-mail.
function iniciais(nome, email) {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (email ?? '?').slice(0, 2).toUpperCase()
}

// Tela inicial ("/"): hub de ferramentas do sistema. O dashboard de RDO em
// si mora em /rdo (ver src/pages/Rdo.jsx) — essa tela só lista, em cards,
// as ferramentas disponíveis para o usuário logado. Ver src/lib/ferramentas.jsx
// para adicionar uma nova ferramenta ao painel.
export default function Home() {
  const { user, profile, signOut } = useAuth()

  const ferramentasVisiveis = useMemo(
    () => FERRAMENTAS.filter((ferramenta) => !ferramenta.somenteAdmin || profile?.is_admin),
    [profile?.is_admin],
  )

  // Estado do resumo de cada card, por chave da ferramenta:
  // { [chave]: { estatisticas, carregando, atualizadoEm } }. Cada
  // ferramenta busca seu próprio resumo (carregarEstatisticas) de forma
  // independente — uma falha isolada não derruba o painel inteiro, só
  // aquele card fica sem resumo.
  const [resumos, setResumos] = useState({})

  useEffect(() => {
    let ativo = true

    ferramentasVisiveis.forEach((ferramenta) => {
      if (!ferramenta.carregarEstatisticas) return

      setResumos((atual) => ({
        ...atual,
        [ferramenta.chave]: { ...atual[ferramenta.chave], carregando: true },
      }))

      ferramenta
        .carregarEstatisticas()
        .then((estatisticas) => {
          if (!ativo) return
          setResumos((atual) => ({
            ...atual,
            [ferramenta.chave]: { estatisticas, carregando: false, atualizadoEm: new Date() },
          }))
        })
        .catch((err) => {
          console.error(`Erro ao carregar resumo de "${ferramenta.titulo}":`, err.message)
          if (!ativo) return
          setResumos((atual) => ({
            ...atual,
            [ferramenta.chave]: { estatisticas: null, carregando: false },
          }))
        })
    })

    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ferramentasVisiveis])

  return (
    <main className="flex-1 bg-surface p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        {/* Moldura com borda colorida fina: contexto + título à esquerda,
            sessão do usuário à direita. */}
        <div className="overflow-hidden rounded-2xl border border-accent/25 bg-white shadow-sm">
          <div className="h-1.5 bg-accent" />
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                Planejamento &amp; Controle de Obras
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-navy sm:text-3xl">
                Planejamento Integrado{' '}
                <span className="font-normal text-gray-400">· Painel de Ferramentas</span>
              </h1>
              <p className="mt-1 text-sm text-gray-500">Ferramentas de controle interno INPASA</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface px-3 py-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
                  {iniciais(profile?.nome, user?.email)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">
                    {profile?.nome || 'Usuário'}
                  </p>
                  <p className="truncate text-xs text-gray-500">{user?.email}</p>
                </div>
                <span className="ml-1 inline-flex shrink-0 items-center rounded-full border border-gray-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {profile?.is_admin ? 'Admin' : 'Usuário'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Sair
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 mb-3 flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Ferramentas disponíveis
          </p>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ferramentasVisiveis.map((ferramenta) => (
            <ToolCard
              key={ferramenta.chave}
              {...ferramenta}
              estatisticas={resumos[ferramenta.chave]?.estatisticas}
              carregandoEstatisticas={resumos[ferramenta.chave]?.carregando}
              atualizadoEm={resumos[ferramenta.chave]?.atualizadoEm}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
