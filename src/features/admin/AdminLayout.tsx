import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Briefcase,
  CalendarDays,
  Clock,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { Logo } from '@/components/ui/Logo'
import { Sheet } from '@/components/ui/Sheet'
import { useBusiness } from './BusinessContext'
import { NotificationsButton } from './NotificationsSheet'

type Item = { to: string; label: string; icon: LucideIcon; end?: boolean }

const MAIN: Item[] = [
  { to: '/app', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/app/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/app/servicios', label: 'Servicios', icon: Briefcase },
  { to: '/app/disponibilidad', label: 'Horarios', icon: Clock },
]
const MORE: Item[] = [
  { to: '/app/clientes', label: 'Clientes', icon: Users },
  { to: '/app/ajustes', label: 'Ajustes', icon: Settings },
]

/**
 * Navegación adaptable:
 *  - móvil: barra inferior con 4 accesos y "Más" (alcanzable con el pulgar)
 *  - tableta: rail lateral compacto (iconos con etiqueta)
 *  - escritorio: barra lateral completa
 */
export default function AdminLayout() {
  const { business } = useBusiness()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)

  async function logout() {
    await signOut()
    navigate('/acceso', { replace: true })
  }

  return (
    <div className="min-h-dvh">
      {/* Rail (md) y sidebar (lg) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col border-r border-line bg-paper md:flex lg:w-64">
        <div className="flex h-16 items-center justify-center border-b border-line lg:justify-start lg:px-6">
          <span className="lg:hidden font-display text-2xl font-medium">T<span className="text-clay">.</span></span>
          <span className="hidden lg:block"><Logo to="/app" /></span>
        </div>
        <nav aria-label="Principal" className="flex-1 space-y-1 p-2 lg:p-3">
          {[...MAIN, ...MORE].map((it) => (
            <SideLink key={it.to} item={it} />
          ))}
        </nav>
        <div className="space-y-1 border-t border-line p-2 lg:p-3">
          <a
            href={`/b/${business.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] text-muted hover:bg-ink/5 lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm"
          >
            <ExternalLink className="size-5" aria-hidden />
            <span>Mi página</span>
          </a>
          <button
            type="button"
            onClick={logout}
            className="flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-md text-[11px] text-muted hover:bg-ink/5 lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm"
          >
            <LogOut className="size-5" aria-hidden />
            <span>Salir</span>
          </button>
        </div>
      </aside>

      <div className="md:pl-20 lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-ivory/90 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 pl-4 pr-1 md:px-8 md:pr-6">
            <p className="min-w-0 truncate font-display text-lg">{business.name}</p>
            <NotificationsButton tz={business.timezone} />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior (móvil) */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5">
          {MAIN.map((it) => (
            <li key={it.to}>
              <NavLink
                to={it.to}
                end={it.end}
                className={({ isActive }) =>
                  `relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                    isActive ? 'text-clay-strong' : 'text-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute inset-x-4 top-0 h-0.5 bg-clay-strong" aria-hidden />}
                    <it.icon className="size-5" aria-hidden />
                    {it.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted"
            >
              <Menu className="size-5" aria-hidden />
              Más
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Más opciones">
        <ul className="-my-2 divide-y divide-line">
          {MORE.map((it) => (
            <li key={it.to}>
              <NavLink to={it.to} onClick={() => setMoreOpen(false)} className="flex min-h-14 items-center gap-3 text-base">
                <it.icon className="size-5 text-muted" aria-hidden />
                {it.label}
              </NavLink>
            </li>
          ))}
          <li>
            <a href={`/b/${business.slug}`} target="_blank" rel="noreferrer" className="flex min-h-14 items-center gap-3">
              <ExternalLink className="size-5 text-muted" aria-hidden />
              Ver mi página pública
            </a>
          </li>
          <li>
            <button type="button" onClick={logout} className="flex min-h-14 w-full items-center gap-3 text-bad">
              <LogOut className="size-5" aria-hidden />
              Cerrar sesión
            </button>
          </li>
        </ul>
      </Sheet>
    </div>
  )
}

function SideLink({ item }: { item: Item }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors motion-reduce:transition-none lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-[15px] ${
          isActive ? 'bg-ink text-ivory' : 'text-ink hover:bg-ink/5'
        }`
      }
    >
      <item.icon className="size-5" aria-hidden />
      <span>{item.label}</span>
    </NavLink>
  )
}
