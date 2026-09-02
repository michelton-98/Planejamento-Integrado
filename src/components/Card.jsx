// Container padrão para os cards do sistema: cantos arredondados, sombra
// suave (em vez de borda fina) e uma faixa colorida no topo indicando a
// categoria/tipo do card. Usado em todas as telas (dashboard, explorador,
// aprovações, cadastro...) para manter uma linguagem visual única.
//
// `as` troca a tag raiz (ex.: "form" para cards que também são formulários,
// preservando onSubmit/etc via `...rest`).
export default function Card({
  as: Tag = 'div',
  faixaCor = '#12263f',
  categoria,
  titulo,
  acoes,
  children,
  className = '',
  contentClassName = 'p-5 print:p-3',
  ...rest
}) {
  return (
    <Tag
      className={`overflow-hidden rounded-2xl bg-white shadow-md shadow-gray-200/70 print:rounded-lg dark:bg-slate-800 dark:shadow-black/30 ${className}`}
      {...rest}
    >
      <div className="h-1.5 print:h-1" style={{ backgroundColor: faixaCor }} />
      <div className={contentClassName}>
        {categoria && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 print:hidden dark:text-slate-500">
            {categoria}
          </p>
        )}
        {(titulo || acoes) && (
          // `acoes` (ex.: botão "Editar data" no card de escopo do Avanço
          // Integrado, ver AvancoDataBase.jsx): fica ao lado do título, fora
          // do <h3> (heading não deveria conter botão) — opcional, não
          // muda o markup de quem só passa `titulo` (comportamento igual
          // ao de antes).
          <div className={`flex items-start justify-between gap-3 ${children ? 'mb-4 print:mb-2' : ''}`}>
            {titulo && <h3 className="text-sm font-medium text-navy dark:text-slate-100">{titulo}</h3>}
            {acoes && <div className="flex shrink-0 items-center gap-2 print:hidden">{acoes}</div>}
          </div>
        )}
        {children}
      </div>
    </Tag>
  )
}
