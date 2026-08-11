import { useAuth } from '../lib/AuthContext'
import ToolCard from '../components/ToolCard'
import { FERRAMENTAS } from '../lib/ferramentas'

// Tela inicial ("/"): hub de ferramentas do sistema. O dashboard de RDO em
// si mora em /rdo (ver src/pages/Rdo.jsx) — essa tela só lista, em cards,
// as ferramentas disponíveis para o usuário logado. Ver src/lib/ferramentas.jsx
// para adicionar uma nova ferramenta ao painel.
export default function Home() {
  const { profile } = useAuth()

  const ferramentasVisiveis = FERRAMENTAS.filter(
    (ferramenta) => !ferramenta.somenteAdmin || profile?.is_admin,
  )

  return (
    <main className="flex-1 bg-surface p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-xl font-semibold text-navy sm:text-2xl">Painel de Ferramentas</h1>
        <p className="mt-1 mb-6 text-sm text-gray-500">Escolha uma ferramenta para começar.</p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ferramentasVisiveis.map((ferramenta) => (
            <ToolCard key={ferramenta.chave} {...ferramenta} />
          ))}
        </div>
      </div>
    </main>
  )
}
