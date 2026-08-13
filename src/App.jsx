import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import { ThemeProvider, useTheme } from './lib/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Header from './components/Header'
import RdoToolNav from './components/RdoToolNav'
import Home from './pages/Home'
import Rdo from './pages/Rdo'
import Login from './pages/Login'
import EsqueciSenha from './pages/EsqueciSenha'
import RedefinirSenha from './pages/RedefinirSenha'
import Cadastro from './pages/Cadastro'
import AguardandoAprovacao from './pages/AguardandoAprovacao'
import Input from './pages/Input'
import Validacoes from './pages/Validacoes'
import AdminUsuarios from './pages/admin/AdminUsuarios'

// Chrome padrão do app (cabeçalho + fundo) — usado nas telas internas. As
// telas de autenticação (login, esqueci/redefinir senha) têm sua própria
// tela cheia e não usam esse layout — por isso nunca ficam escuras, mesmo
// que o modo noturno esteja ativado (a classe `dark` só existe aqui
// dentro, nunca em <html>/<body>; ver ThemeContext.jsx).
function AppLayout({ children }) {
  const { tema } = useTheme()
  return (
    <div className={`flex min-h-screen flex-col bg-surface dark:bg-slate-900 ${tema === 'dark' ? 'dark' : ''}`}>
      <Header />
      {children}
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        {/* import.meta.env.BASE_URL reflete o "base" do vite.config.js — "/"
            na Vercel, "/Planejamento-Integrado/" no build do GitHub Pages. Sem isso,
            as rotas ficariam erradas no subcaminho do Pages. */}
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />
            <Route
              path="/cadastro"
              element={
                <AppLayout>
                  <Cadastro />
                </AppLayout>
              }
            />
            <Route
              path="/aguardando-aprovacao"
              element={
                <AppLayout>
                  <AguardandoAprovacao />
                </AppLayout>
              }
            />
            <Route
              path="/admin/usuarios"
              element={
                <AppLayout>
                  <AdminRoute>
                    <AdminUsuarios />
                  </AdminRoute>
                </AppLayout>
              }
            />
            {/* Rota antiga (tela de Aprovações) — mantida como redirecionamento
                para não quebrar links/favoritos existentes. */}
            <Route path="/admin/aprovacoes" element={<Navigate to="/admin/usuarios" replace />} />
            <Route
              path="/"
              element={
                <AppLayout>
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                </AppLayout>
              }
            />
            <Route
              path="/rdo"
              element={
                <AppLayout>
                  <ProtectedRoute>
                    <>
                      <RdoToolNav />
                      <Rdo />
                    </>
                  </ProtectedRoute>
                </AppLayout>
              }
            />
            <Route
              path="/input"
              element={
                <AppLayout>
                  <AdminRoute>
                    <>
                      <RdoToolNav />
                      <Input />
                    </>
                  </AdminRoute>
                </AppLayout>
              }
            />
            <Route
              path="/validacoes"
              element={
                <AppLayout>
                  <ProtectedRoute>
                    <Validacoes />
                  </ProtectedRoute>
                </AppLayout>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
