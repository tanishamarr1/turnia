import type { AppointmentStatus } from '@/lib/types'

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Completada',
  no_show: 'No asistió',
  expired: 'Expirada',
}

const TONE: Record<AppointmentStatus, string> = {
  pending: 'bg-warn-soft text-warn',
  confirmed: 'bg-ok-soft text-ok',
  cancelled: 'bg-bad-soft text-bad',
  completed: 'bg-line text-ink',
  no_show: 'bg-bad-soft text-bad',
  expired: 'bg-line text-muted',
}

/** Color del borde izquierdo para identificar el estado de un vistazo en listas y agenda. */
export const STATUS_STRIPE: Record<AppointmentStatus, string> = {
  pending: 'border-warn',
  confirmed: 'border-ok',
  cancelled: 'border-bad/40',
  completed: 'border-line-strong',
  no_show: 'border-bad',
  expired: 'border-line-strong',
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold ${TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}
