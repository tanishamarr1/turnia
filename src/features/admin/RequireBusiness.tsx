import { Navigate } from 'react-router-dom'
import { ErrorState, Loading } from '@/components/ui/States'
import { useBusinessContext } from './BusinessContext'
import AdminLayout from './AdminLayout'

/** Solo deja pasar al panel si la persona tiene un negocio con la incorporación terminada. */
export default function RequireBusiness() {
  const { loading, business, error, refresh } = useBusinessContext()
  if (loading) return <Loading full />
  if (error) return <ErrorState message={error} onRetry={refresh} />
  if (!business || !business.onboarding_completed) return <Navigate to="/app/bienvenida" replace />
  return <AdminLayout />
}
