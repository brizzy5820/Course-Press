import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Preloader from './Preloader'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

export function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

export function FullPageLoader() {
  return <Preloader label="Checking access" />
}
