import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth } from '@/auth/RequireAuth'
import { Loading } from '@/components/ui/States'
import { isSupabaseConfigured } from '@/lib/supabase'
import { BusinessProvider } from '@/features/admin/BusinessContext'

const HomePage = lazy(() => import('@/features/home/HomePage'))
const LoginPage = lazy(() => import('@/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/auth/ResetPasswordPage'))
const PublicBusinessPage = lazy(() => import('@/features/public/PublicBusinessPage'))
const BookingConfirmationPage = lazy(() => import('@/features/public/BookingConfirmationPage'))
const OnboardingPage = lazy(() => import('@/features/admin/OnboardingPage'))
const RequireBusiness = lazy(() => import('@/features/admin/RequireBusiness'))
const OverviewPage = lazy(() => import('@/features/admin/OverviewPage'))
const AgendaPage = lazy(() => import('@/features/agenda/AgendaPage'))
const ServicesPage = lazy(() => import('@/features/services/ServicesPage'))
const AvailabilityPage = lazy(() => import('@/features/availability/AvailabilityPage'))
const ClientsPage = lazy(() => import('@/features/clients/ClientsPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))

function MissingConfig() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-lg place-items-center px-5">
      <div>
        <h1 className="font-display text-4xl">Falta conectar Supabase</h1>
        <p className="mt-3 text-muted">
          Crea un archivo <code className="rounded-sm bg-line px-1.5 py-0.5 text-sm">.env.local</code> con{' '}
          <code className="rounded-sm bg-line px-1.5 py-0.5 text-sm">VITE_SUPABASE_URL</code> y{' '}
          <code className="rounded-sm bg-line px-1.5 py-0.5 text-sm">VITE_SUPABASE_ANON_KEY</code> (usa .env.example como guía) y reinicia{' '}
          <code className="rounded-sm bg-line px-1.5 py-0.5 text-sm">npm run dev</code>.
        </p>
      </div>
    </main>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <MissingConfig />

  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Loading full />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/acceso" element={<LoginPage />} />
            <Route path="/registro" element={<RegisterPage />} />
            <Route path="/recuperar" element={<ForgotPasswordPage />} />
            <Route path="/restablecer" element={<ResetPasswordPage />} />

            <Route path="/b/:slug" element={<PublicBusinessPage />} />
            <Route path="/reserva/:token" element={<BookingConfirmationPage />} />

            <Route
              path="/app"
              element={
                <RequireAuth>
                  <BusinessProvider>
                    <Outlet />
                  </BusinessProvider>
                </RequireAuth>
              }
            >
              <Route path="bienvenida" element={<OnboardingPage />} />
              <Route element={<RequireBusiness />}>
                <Route index element={<OverviewPage />} />
                <Route path="agenda" element={<AgendaPage />} />
                <Route path="servicios" element={<ServicesPage />} />
                <Route path="disponibilidad" element={<AvailabilityPage />} />
                <Route path="clientes" element={<ClientsPage />} />
                <Route path="ajustes" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
