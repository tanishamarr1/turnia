import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Loading } from '@/components/ui/States'

/** Si la sesión expira o se cierra, la persona vuelve al acceso y regresa a donde estaba al entrar. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading full />
  if (!session) return <Navigate to="/acceso" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}
