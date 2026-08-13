import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const CHAVE_STORAGE = 'planejamento-integrado:tema'

function lerTemaSalvo() {
  if (typeof window === 'undefined') return 'light'
  try {
    return window.localStorage.getItem(CHAVE_STORAGE) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/**
 * Preferência de tema (claro/escuro) das telas internas (pós-login) —
 * persistida no localStorage do navegador (chave abaixo), pra não precisar
 * reativar toda vez que abrir o app de novo no mesmo navegador. Controla só
 * a classe `dark` aplicada no <AppLayout> (ver App.jsx) — a tela de login e
 * as de recuperação de senha não usam esse layout, então nunca ficam
 * escuras, mesmo com o modo noturno ativado antes de sair.
 *
 * Sem nenhuma relação com os relatórios em PDF (pdfReport.js /
 * pdfReportValidacoes.js): eles desenham cores fixas via jsPDF, fora do
 * DOM, então o tema da tela nunca os afeta — sempre exportam claros.
 */
export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(lerTemaSalvo)

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE_STORAGE, tema)
    } catch {
      // localStorage indisponível (ex.: navegação privada) — a troca de
      // tema continua funcionando, só não persiste entre sessões.
    }
  }, [tema])

  function alternarTema() {
    setTema((atual) => (atual === 'dark' ? 'light' : 'dark'))
  }

  return <ThemeContext.Provider value={{ tema, alternarTema }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const contexto = useContext(ThemeContext)
  if (!contexto) throw new Error('useTheme precisa ser usado dentro de <ThemeProvider>.')
  return contexto
}
