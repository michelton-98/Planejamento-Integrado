import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Header from './components/Header'
import Home from './pages/Home'
import Login from './pages/Login'
import EsqueciSenha from './pages/EsqueciSenha'
import RedefinirSenha from './pages/RedefinirSenha'
import Cadastro from './pages/Cadastro'
import AguardandoAprovacao from './pages/AguardandoAprovacao'
import Input from './pages/Input'
import Aprovacoes from './pages/admin/Aprovacoes'

// Chrome padrão do app (cabeçalho + fundo) — usado nas telas internas.
// As telas de autenticação (login, esqueci/redefinir senha) têm sua
// própria tela cheia e não usam esse layout.
function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Header />
      {children}
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
            path="/admin/aprovacoes"
            element={
              <AppLayout>
                <AdminRoute>
                  <Aprovacoes />
                </AdminRoute>
              </AppLayout>
            }
          />
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
            path="/input"
            element={
              <AppLayout>
                <AdminRoute>
                  <Input />
                </AdminRoute>
              </AppLayout>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
