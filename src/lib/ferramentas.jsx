// Catálogo de ferramentas do Painel (tela inicial "/"). Cada entrada vira
// um card — pra adicionar uma nova ferramenta no futuro basta acrescentar
// um item aqui, sem tocar na tela do painel em si. `somenteAdmin` filtra o
// card pra quem tem perfil.is_admin (ex.: Gestão de Usuários).
export const FERRAMENTAS = [
  {
    chave: 'rdo',
    titulo: 'Controle de RDO',
    categoria: 'Obras · Acompanhamento',
    descricao: 'Indicadores, pendências por disciplina e relatório diário de aprovação de RDOs.',
    href: '/rdo',
    corFaixa: '#2f6fed',
    somenteAdmin: false,
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-6 w-6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 3.75h6a1.5 1.5 0 0 1 1.5 1.5v.75h1.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4.5 19.5v-12a1.5 1.5 0 0 1 1.5-1.5H7.5V5.25A1.5 1.5 0 0 1 9 3.75Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 10.5h7.5M8.25 13.5h7.5M8.25 16.5h4.5" />
      </svg>
    ),
  },
  {
    chave: 'usuarios',
    titulo: 'Gestão de Usuários',
    categoria: 'Administração · Acesso',
    descricao: 'Aprove cadastros, promova administradores e remova acessos do sistema.',
    href: '/admin/usuarios',
    corFaixa: '#a9791f',
    somenteAdmin: true,
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-6 w-6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.5a4.5 4.5 0 0 0-9 0M18.75 19.5a4.125 4.125 0 0 0-3.132-4M10.5 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17.25 11.25a3 3 0 0 0 2.906-3.75"
        />
      </svg>
    ),
  },
]
