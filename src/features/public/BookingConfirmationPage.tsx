import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarCheck, Clock3, MapPin, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAsyncData } from '@/lib/hooks'
import { humanError } from '@/lib/errors'
import { formatInstant, formatTime } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import type { AppointmentStatus } from '@/lib/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ErrorState, Loading, Notice } from '@/components/ui/States'
import { Sheet } from '@/components/ui/Sheet'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Logo } from '@/components/ui/Logo'

type Booking = {
  id: string
  status: AppointmentStatus
  start_at: string
  end_at: string
  service_name: string
  price_cents: number
  currency: string
  customer_name: string
  notes: string | null
  references_count: number
  business: { name: string; slug: string; timezone: string; address: string | null; phone: string | null }
}

const HEADLINE: Record<AppointmentStatus, string> = {
  confirmed: 'Reserva confirmada',
  pending: 'Reserva recibida',
  cancelled: 'Reserva cancelada',
  completed: 'Cita completada',
  no_show: 'Cita no atendida',
  expired: 'Reserva expirada',
}

export default function BookingConfirmationPage() {
  const { token = '' } = useParams()
  const [override, setOverride] = useState<Booking | null>(null)
  const [askCancel, setAskCancel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const { data, loading, error, reload } = useAsyncData(async () => {
    const r = await supabase.rpc('get_booking_by_token', { p_token: token })
    if (r.error) throw r.error
    return r.data as Booking
  }, [token])

  const booking = override ?? data

  async function cancel() {
    setBusy(true)
    setCancelError(null)
    try {
      const r = await supabase.rpc('cancel_booking_by_token', { p_token: token })
      if (r.error) throw r.error
      setOverride(r.data as Booking)
      setAskCancel(false)
    } catch (e) {
      setCancelError(humanError(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading && !booking) return <Loading full />
  if (error || !booking) return <ErrorState message={error ?? 'No encontramos esta reserva.'} onRetry={reload} />

  const tz = booking.business.timezone
  const canCancel = (booking.status === 'pending' || booking.status === 'confirmed') && new Date(booking.start_at) > new Date()
  const ref = booking.id.slice(0, 8).toUpperCase()

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Logo />

      <header className="mt-10">
        <CalendarCheck className="size-7 text-clay-strong" aria-hidden />
        <h1 className="mt-3 font-display text-4xl leading-tight">{HEADLINE[booking.status]}</h1>
        <div className="mt-3">
          <StatusBadge status={booking.status} />
        </div>
        {booking.status === 'pending' && (
          <p className="mt-3 text-muted">{booking.business.name} debe confirmar tu reserva. Vuelve a este enlace para ver el estado.</p>
        )}
      </header>

      <section className="mt-8 border-y border-line py-6">
        <p className="font-display text-3xl capitalize leading-tight">
          {formatInstant(booking.start_at, tz, { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <p className="mt-1 flex items-center gap-2 text-lg">
          <Clock3 className="size-5 text-muted" aria-hidden />
          {formatTime(booking.start_at, tz)} a {formatTime(booking.end_at, tz)}
        </p>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Servicio</dt>
            <dd className="text-right font-medium">{booking.service_name}</dd>
          </div>
          {booking.price_cents > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Precio</dt>
              <dd className="font-medium">{formatMoney(booking.price_cents, booking.currency)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted">A nombre de</dt>
            <dd className="text-right font-medium">{booking.customer_name}</dd>
          </div>
          {booking.references_count > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Fotos adjuntas</dt>
              <dd className="font-medium">{booking.references_count}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Código</dt>
            <dd className="font-mono font-medium">{ref}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-2xl">{booking.business.name}</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {booking.business.address && (
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
              {booking.business.address}
            </li>
          )}
          {booking.business.phone && (
            <li className="flex items-center gap-2.5">
              <Phone className="size-4 shrink-0 text-muted" aria-hidden />
              <a href={`tel:${booking.business.phone}`} className="underline underline-offset-4">
                {booking.business.phone}
              </a>
            </li>
          )}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink to={`/b/${booking.business.slug}`} variant="secondary">
          Hacer otra reserva
        </ButtonLink>
        {canCancel && (
          <Button variant="danger" onClick={() => setAskCancel(true)}>
            Cancelar reserva
          </Button>
        )}
      </div>

      <p className="mt-8 text-sm text-muted">
        Guarda este enlace: es tu acceso a la reserva.{' '}
        <Link to="/" className="underline underline-offset-4">
          Conoce Turnia
        </Link>
      </p>

      <Sheet
        open={askCancel}
        onClose={() => setAskCancel(false)}
        title="¿Cancelar la reserva?"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setAskCancel(false)} disabled={busy}>
              Mantener
            </Button>
            <Button variant="danger" className="flex-1" loading={busy} onClick={cancel}>
              Sí, cancelar
            </Button>
          </div>
        }
      >
        <p>El horario quedará libre para otras personas. Esta acción no se puede deshacer.</p>
        {cancelError && (
          <div className="mt-4">
            <Notice>{cancelError}</Notice>
          </div>
        )}
      </Sheet>
    </div>
  )
}
