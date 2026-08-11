import { Link } from 'react-router-dom'

// Card do Painel de Ferramentas: faixa colorida fina no topo, ícone,
// categoria em caixa alta, título em destaque e um link "Abrir ferramenta"
// fixado no rodapé (mt-auto), mesma linguagem visual do <Card /> usado no
// resto do app (cantos arredondados + sombra leve em vez de borda).
export default function ToolCard({ titulo, categoria, descricao, href, corFaixa = '#2f6fed', icone }) {
  return (
    <Link
      to={href}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-md shadow-gray-200/70 transition-shadow hover:shadow-lg"
    >
      <div className="h-1.5" style={{ backgroundColor: corFaixa }} />
      <div className="flex flex-1 flex-col p-6">
        <div
          className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${corFaixa}1a`, color: corFaixa }}
        >
          {icone}
        </div>

        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {categoria}
        </p>
        <h3 className="text-lg font-semibold text-navy">{titulo}</h3>
        {descricao && <p className="mt-2 text-sm text-gray-500">{descricao}</p>}

        <div className="mt-5 flex items-center gap-1 pt-4 text-xs font-semibold uppercase tracking-wider text-accent">
          Abrir ferramenta
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </div>
      </div>
    </Link>
  )
}
