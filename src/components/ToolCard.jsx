import { Link } from 'react-router-dom'
import Spinner from './Spinner'

function formatarHora(data) {
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Card do Painel de Ferramentas: faixa colorida fina no topo, ícone,
// categoria em caixa alta, título em destaque, um resumo opcional
// (colunas de números + barras de progresso, buscado por
// `estatisticas`/`carregandoEstatisticas` — ver Home.jsx) e um link
// "Abrir ferramenta" fixado no rodapé (mt-auto). Hover eleva o card
// (sombra mais forte + leve translação) pra reforçar que é clicável.
export default function ToolCard({
  titulo,
  categoria,
  descricao,
  href,
  corFaixa = '#2f6fed',
  icone,
  estatisticas,
  carregandoEstatisticas,
  atualizadoEm,
}) {
  return (
    <Link
      to={href}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-md shadow-gray-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gray-300/60 dark:bg-slate-800 dark:shadow-black/30 dark:hover:shadow-black/50"
    >
      <div className="h-1.5" style={{ backgroundColor: corFaixa }} />
      <div className="flex flex-1 flex-col p-6">
        <div
          className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${corFaixa}1a`, color: corFaixa }}
        >
          {icone}
        </div>

        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
          {categoria}
        </p>
        <h3 className="text-lg font-semibold text-navy dark:text-slate-100">{titulo}</h3>
        {descricao && <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">{descricao}</p>}

        {carregandoEstatisticas ? (
          <div className="mt-5 flex items-center gap-2 border-t border-gray-100 pt-4 text-xs text-gray-400 dark:border-slate-700 dark:text-slate-500">
            <Spinner className="h-3.5 w-3.5" />
            Carregando resumo...
          </div>
        ) : estatisticas ? (
          <div className="mt-5 border-t border-gray-100 pt-4 dark:border-slate-700">
            {estatisticas.colunas?.length > 0 && (
              <div className="flex divide-x divide-gray-100 dark:divide-slate-700">
                {estatisticas.colunas.map((coluna) => (
                  <div key={coluna.rotulo} className="flex-1 px-2 first:pl-0 last:pr-0">
                    <p className="text-xl font-semibold text-navy dark:text-slate-100">{coluna.valor}</p>
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">{coluna.rotulo}</p>
                  </div>
                ))}
              </div>
            )}

            {estatisticas.barras?.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {estatisticas.barras.map((barra) => (
                  <div key={barra.rotulo}>
                    <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
                      <span>{barra.rotulo}</span>
                      <span className="font-semibold text-navy dark:text-slate-100">{barra.percentual}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${barra.percentual}%`, backgroundColor: barra.cor ?? corFaixa }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {atualizadoEm && (
              <p className="mt-3 text-[11px] text-gray-400 dark:text-slate-500">atualizado {formatarHora(atualizadoEm)}</p>
            )}
          </div>
        ) : null}

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
