import { Link } from 'react-router-dom'
import { FASES_AVANCO } from '../lib/avancoIntegradoConfig'

// Card de uma "fase" no sub-painel do Avanço Integrado — mesmo padrão
// visual do ToolCard do Painel de Ferramentas (faixa colorida + cantos
// arredondados + sombra), só que sem resumo/estatísticas. Fase habilitada
// vira link clicável; as demais ficam "meio apagadas" (opacidade reduzida,
// sem cursor de link) com um badge "Em breve" sobreposto.
function QuadroFase({ titulo, href, habilitada }) {
  const conteudo = (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-md shadow-gray-200/70 transition-all duration-200 dark:bg-slate-800 dark:shadow-black/30 ${
        habilitada
          ? 'hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gray-300/60 dark:hover:shadow-black/50'
          : 'opacity-50'
      }`}
    >
      <div className="h-1.5 bg-accent" />
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <h3 className="text-base font-semibold text-navy dark:text-slate-100">{titulo}</h3>
        {habilitada && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-accent">
            Abrir ferramenta
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </span>
        )}
      </div>

      {!habilitada && (
        <span className="absolute right-3 top-3 rounded-full bg-navy/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white dark:bg-slate-700">
          Em breve
        </span>
      )}
    </div>
  )

  if (!habilitada) {
    return (
      <div aria-disabled="true" className="cursor-not-allowed">
        {conteudo}
      </div>
    )
  }

  return <Link to={href}>{conteudo}</Link>
}

/**
 * Hub da ferramenta "Avanço Integrado" (/avanco-integrado): sub-painel com
 * uma "fase" da planta por quadro (ver FASES_AVANCO em
 * avancoIntegradoConfig.js) — só "Destilaria Fase I" tem ferramenta de
 * verdade por trás por enquanto; as outras 4 entram já cadastradas no
 * catálogo, só esperando serem habilitadas num próximo prompt.
 */
export default function AvancoIntegrado() {
  return (
    <main className="flex-1 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-lg font-semibold text-navy dark:text-slate-100">Avanço Integrado</h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-slate-400">
          Escolha a fase da planta para acompanhar o avanço físico por disciplina e empresa.
        </p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FASES_AVANCO.map((fase) => (
            <QuadroFase key={fase.chave} titulo={fase.titulo} href={fase.href} habilitada={fase.habilitada} />
          ))}
        </div>
      </div>
    </main>
  )
}
