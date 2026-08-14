import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { FERRAMENTAS, podeImportarRdos } from '../lib/ferramentas'

const ABA_BASE =
  'border-b-2 px-1 py-3 text-sm font-medium transition-colors -mb-px'
const ABA_ATIVA = 'border-accent text-accent'
const ABA_INATIVA =
  'border-transparent text-gray-500 hover:border-gray-300 hover:text-navy dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100'

// Título/descrição reaproveitados do card do Painel (ferramentas.jsx) —
// fonte única, sem duplicar o texto aqui.
const FERRAMENTA_RDO = FERRAMENTAS.find((ferramenta) => ferramenta.chave === 'rdo')

// Cabeçalho (título + subtítulo) e sub-navegação interna da ferramenta
// "Controle de RDO": só aparece dentro dela (/rdo e /input), nunca no
// cabeçalho global — ver Header.jsx. "Importar RDOs" é visível pra admin
// ou pra quem tem a permissão pode_importar_rdos (ver podeImportarRdos e
// "Personalizar Acesso" em AdminUsuarios.jsx) — mesma regra de acesso que
// a rota /input já aplica (ProtectedRoute ferramenta="rdo" requerImportarRdos).
export default function RdoToolNav() {
  const { profile } = useAuth()

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 print:hidden">
        <h1 className="mb-1 text-lg font-semibold text-navy dark:text-slate-100">{FERRAMENTA_RDO.titulo}</h1>
        <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">{FERRAMENTA_RDO.descricao}</p>
      </div>
      <nav className="border-b border-gray-200 bg-white px-4 sm:px-6 print:hidden dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto flex max-w-6xl gap-6">
          <NavLink
            to="/rdo"
            end
            className={({ isActive }) => `${ABA_BASE} ${isActive ? ABA_ATIVA : ABA_INATIVA}`}
          >
            Dashboard
          </NavLink>
          {podeImportarRdos(profile) && (
            <NavLink
              to="/input"
              className={({ isActive }) => `${ABA_BASE} ${isActive ? ABA_ATIVA : ABA_INATIVA}`}
            >
              Importar RDOs
            </NavLink>
          )}
        </div>
      </nav>
    </>
  )
}
