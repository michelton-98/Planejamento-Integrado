import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import Spinner from './Spinner'

export default function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 p-6 text-gray-500">
        <Spinner className="h-5 w-5" />
        Carregando...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (profile?.status_aprovacao !== 'aprovado') {
    return <Navigate to="/aguardando-aprovacao" replace />
  }

  return children
}
