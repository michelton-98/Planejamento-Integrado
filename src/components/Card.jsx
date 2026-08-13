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
        {titulo && (
          <h3 className={`text-sm font-medium text-navy dark:text-slate-100 ${children ? 'mb-4 print:mb-2' : ''}`}>
            {titulo}
          </h3>
        )}
        {children}
      </div>
    </Tag>
  )
}
