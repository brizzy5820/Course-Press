import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

export function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (!user ) return <Navigate to="/login" replace />
  return children
}

export function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-spine">
      <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
    </div>
  )
}
