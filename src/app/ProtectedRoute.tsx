import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import type { UserRole } from '../features/auth/types'

type ProtectedRouteProps = {
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />
  }

  if (allowedRoles && !user?.roles.some(role => allowedRoles.includes(role))) {
    return <p role="alert">No tienes permisos para acceder a esta página.</p>
  }

  return <Outlet />
}
