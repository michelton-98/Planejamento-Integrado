import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import Spinner from './Spinner'

export default function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 p-6 text-gray-500">
        <Spinner className="h-5 w-5" />
        Carregando...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile?.is_admin) {
    return <Navigate to="/" replace />
  }

  return children
}
