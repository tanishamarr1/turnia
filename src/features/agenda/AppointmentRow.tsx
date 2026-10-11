import { timeParts, formatTime } from '@/lib/dates'
import type { Appointment } from '@/lib/types'
import { StatusBadge, STATUS_STRIPE } from '@/components/ui/StatusBadge'

/**
 * Una entrada de la agenda, como en una libreta de citas: la hora en tipografía editorial a la izquierda,
 * la persona y el servicio al centro, el estado a la derecha. El borde izquierdo codifica el estado.
 */
export function AppointmentRow({
  appt,
  tz,
  onOpen,
}: {
  appt: Appointment
  tz: string
  onOpen: (a: Appointment) => void
}) {
  const t = timeParts(appt.start_at, tz)
  const dim = appt.status === 'cancelled' || appt.status === 'expired'
  return (
    <button
      type="button"
      onClick={() => onOpen(appt)}
      className={`grid min-h-[4.5rem] w-full grid-cols-[4.75rem_minmax(0,1fr)] items-start gap-x-3 border-l-4 py-3 pl-3 pr-2 text-left transition-colors hover:bg-paper motion-reduce:transition-none sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] ${STATUS_STRIPE[appt.status]} ${dim ? 'opacity-70' : ''}`}
    >
      <span className="leading-none">
        <span className="font-display text-2xl">{t.clock}</span>
        <span className="mt-1 block text-xs text-muted">{t.period}</span>
      </span>
      <span className="min-w-0">
        <span className={`block truncate font-medium ${dim ? 'line-through' : ''}`}>{appt.customer_name}</span>
        <span className="block truncate text-sm text-muted">{appt.service_name}</span>
        <span className="mt-0.5 block text-xs text-muted">
          Termina {formatTime(appt.end_at, tz)}
        </span>
        <span className="mt-2 block sm:hidden">
          <StatusBadge status={appt.status} />
        </span>
      </span>
      <span className="hidden sm:block">
        <StatusBadge status={appt.status} />
      </span>
    </button>
  )
}
