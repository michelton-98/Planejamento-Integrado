// Layout compartilhado das telas de autenticação (login, esqueci minha
// senha, redefinir senha): fundo azul-marinho de tela cheia com um
// cabeçalho institucional, e um card branco centralizado por baixo.
export default function AuthLayout({ children }) {
  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-navy to-[#0a1830]">
      <div className="flex flex-col items-center px-6 pb-8 pt-16 text-center sm:pt-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
          Planejamento &amp; Controle de Obras
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
          Controle de RDO · Sistema
        </h1>
        <p className="mt-2 text-sm text-white/50">acesso restrito</p>
      </div>

      <div className="flex flex-1 items-start justify-center px-6 pb-16">
        <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="h-1.5 bg-navy" />
          <div className="p-6 sm:p-8">{children}</div>
        </div>
      </div>
    </main>
  )
}
