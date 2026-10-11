import { useState } from 'react'
import { Copy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAsyncData } from '@/lib/hooks'
import { addDays, addMonths, dayRangeUtc, monthStart, todayKey, zonedToUtc, formatDayLong, formatInstant } from '@/lib/dates'
import { copyText, formatMoney, publicUrl } from '@/lib/format'
import type { Appointment } from '@/lib/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, Loading } from '@/components/ui/States'
import { useBusiness } from './BusinessContext'
import { AppointmentRow } from '../agenda/AppointmentRow'
import { AppointmentSheet } from '../agenda/AppointmentSheet'

export default function OverviewPage() {
  const { business } = useBusiness()
  const tz = business.timezone
  const today = todayKey(tz)
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [copied, setCopied] = useState(false)

  const { data, loading, error, reload } = useAsyncData(async () => {
    const day = dayRangeUtc(today, tz)
    const now = new Date().toISOString()
    const weekEnd = zonedToUtc(addDays(today, 7), '00:00', tz).toISOString()
    const since = new Date(Date.now() - 30 * 864e5).toISOString()
    const mStart = zonedToUtc(monthStart(today), '00:00', tz).toISOString()
    const mEnd = zonedToUtc(addMonths(today, 1), '00:00', tz).toISOString()
    const base = () => supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('business_id', business.id)

    const [todayList, next, pending, cancelled, week, month] = await Promise.all([
      supabase.from('appointments').select('*').eq('business_id', business.id).gte('start_at', day.from).lt('start_at', day.to)
        .in('status', ['pending', 'confirmed', 'completed']).order('start_at'),
      supabase.from('appointments').select('*').eq('business_id', business.id).gte('start_at', day.to)
        .in('status', ['pending', 'confirmed']).order('start_at').limit(5),
      base().eq('status', 'pending').gte('start_at', now),
      base().eq('status', 'cancelled').gte('cancelled_at', since),
      base().in('status', ['pending', 'confirmed']).gte('start_at', now).lt('start_at', weekEnd),
      supabase.from('appointments').select('price_cents,currency').eq('business_id', business.id)
        .in('status', ['confirmed', 'completed']).gte('start_at', mStart).lt('start_at', mEnd),
    ])
    for (const r of [todayList, next, pending, cancelled, week, month]) if (r.error) throw r.error

    const rows = (month.data ?? []) as { price_cents: number; currency: string }[]
    const currencies = new Set(rows.map((r) => r.currency))
    return {
      today: (todayList.data ?? []) as Appointment[],
      next: (next.data ?? []) as Appointment[],
      pending: pending.count ?? 0,
      cancelled: cancelled.count ?? 0,
      week: week.count ?? 0,
      // Solo se muestra si todas las citas del mes usan la misma moneda (no se mezclan monedas).
      revenue: currencies.size === 1 ? { cents: rows.reduce((s, r) => s + r.price_cents, 0), currency: [...currencies][0] } : null,
    }
  }, [business.id, today])

  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const stats: { label: string; value: string; hint?: string }[] = [
    { label: 'Citas hoy', value: String(data.today.filter((a) => a.status !== 'cancelled').length) },
    { label: 'Próximos 7 días', value: String(data.week), hint: 'activas desde ahora' },
    { label: 'Por confirmar', value: String(data.pending) },
    { label: 'Canceladas', value: String(data.cancelled), hint: 'últimos 30 días' },
  ]

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-4xl">Resumen</h1>
        <p className="mt-1 capitalize text-muted">{formatDayLong(today)}</p>
      </header>

      <dl className="grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-ivory p-4 md:p-5">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="mt-1 font-display text-5xl leading-none">{s.value}</dd>
            {s.hint && <p className="mt-1.5 text-xs text-muted">{s.hint}</p>}
          </div>
        ))}
      </dl>

      {data.revenue && data.revenue.cents > 0 && (
        <p className="text-sm text-muted">
          Ingresos previstos este mes, según precios de citas confirmadas y completadas:{' '}
          <strong className="text-ink">{formatMoney(data.revenue.cents, data.revenue.currency)}</strong>
        </p>
      )}

      {data.pending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-warn bg-warn-soft px-4 py-3">
          <p className="font-medium text-warn">
            {data.pending === 1 ? 'Tienes 1 reserva por confirmar.' : `Tienes ${data.pending} reservas por confirmar.`}
          </p>
          <ButtonLink to="/app/agenda" variant="secondary">
            Abrir agenda
          </ButtonLink>
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="o-today">
          <h2 id="o-today" className="font-display text-2xl">
            Hoy
          </h2>
          {data.today.length === 0 ? (
            <EmptyState title="Sin citas hoy" text="Cuando haya reservas para hoy, las verás aquí." />
          ) : (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {data.today.map((a) => (
                <li key={a.id}>
                  <AppointmentRow appt={a} tz={tz} onOpen={setSelected} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="o-next">
          <h2 id="o-next" className="font-display text-2xl">
            Próximas reservas
          </h2>
          {data.next.length === 0 ? (
            <EmptyState
              title="Nada programado"
              text="Comparte tu enlace para que tus clientes reserven."
              action={
                <Button
                  variant="secondary"
                  onClick={async () => {
                    setCopied(await copyText(publicUrl(business.slug)))
                    window.setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  <Copy className="size-4" aria-hidden /> {copied ? 'Enlace copiado' : 'Copiar mi enlace'}
                </Button>
              }
            />
          ) : (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {data.next.map((a) => (
                <li key={a.id}>
                  <p className="px-3 pt-2 text-xs capitalize text-muted">{formatInstant(a.start_at, tz, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  <AppointmentRow appt={a} tz={tz} onOpen={setSelected} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AppointmentSheet
        appt={selected}
        tz={tz}
        onClose={() => setSelected(null)}
        onChanged={(a) => {
          setSelected(a)
          reload()
        }}
      />
    </div>
  )
}
