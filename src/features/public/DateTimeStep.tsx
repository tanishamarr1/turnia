import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAsyncData } from '@/lib/hooks'
import { addDays, addMonths, formatDayLong, formatTime, monthEnd, monthStart, todayKey } from '@/lib/dates'
import type { PublicBusiness, Service, Slot } from '@/lib/types'
import { Calendar } from '@/components/ui/Calendar'
import { Loading } from '@/components/ui/States'
import { Notice } from '@/components/ui/States'

export function DateTimeStep({
  business,
  service,
  dateKey,
  slot,
  onPick,
}: {
  business: PublicBusiness
  service: Service
  dateKey: string | null
  slot: Slot | null
  onPick: (dateKey: string, slot: Slot | null) => void
}) {
  const tz = business.timezone
  const today = todayKey(tz)
  const lastBookable = addDays(today, business.max_advance_days)
  const [month, setMonth] = useState(dateKey ?? today)

  const range = useMemo(() => {
    const from = monthStart(month) > today ? monthStart(month) : today
    const end = monthEnd(month)
    const to = end < lastBookable ? end : lastBookable
    return { from, to }
  }, [month, today, lastBookable])

  // Fechas con al menos un hueco: las calcula el servidor con las mismas reglas que al reservar.
  const dates = useAsyncData(async () => {
    if (range.from > range.to) return [] as string[]
    const r = await supabase.rpc('get_available_dates', {
      p_business_id: business.id,
      p_service_id: service.id,
      p_from: range.from,
      p_to: range.to,
    })
    if (r.error) throw r.error
    return (r.data ?? []) as string[]
  }, [business.id, service.id, range.from, range.to])

  const slots = useAsyncData(async () => {
    if (!dateKey) return [] as Slot[]
    const r = await supabase.rpc('get_available_slots', {
      p_business_id: business.id,
      p_service_id: service.id,
      p_date: dateKey,
    })
    if (r.error) throw r.error
    return (r.data ?? []) as Slot[]
  }, [business.id, service.id, dateKey])

  const available = useMemo(() => new Set(dates.data ?? []), [dates.data])
  const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const nextMonthStart = addMonths(month, 1)

  return (
    <div className="space-y-6">
      <Calendar
        month={month}
        onMonthChange={setMonth}
        selected={dateKey}
        today={today}
        onSelect={(k) => onPick(k, null)}
        isEnabled={(k) => available.has(k)}
        highlight={(k) => available.has(k)}
        canPrev={monthStart(month) > monthStart(today)}
        canNext={nextMonthStart <= lastBookable}
        busy={dates.loading}
      />

      {dates.error && <Notice>{dates.error}</Notice>}
      {!dates.loading && !dates.error && available.size === 0 && (
        <Notice tone="warn">No hay fechas libres en este mes. Prueba con el mes siguiente.</Notice>
      )}

      {dateKey && (
        <section aria-labelledby="slots-title">
          <h3 id="slots-title" className="font-display text-xl capitalize">
            {formatDayLong(dateKey)}
          </h3>
          {slots.loading && !slots.data ? (
            <Loading label="Buscando horas" />
          ) : slots.error ? (
            <div className="mt-3">
              <Notice>{slots.error}</Notice>
            </div>
          ) : (slots.data ?? []).length === 0 ? (
            <p className="mt-2 text-muted">No quedan horas libres este día. Elige otra fecha.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(slots.data ?? []).map((s) => {
                const selected = slot?.slot_start === s.slot_start
                return (
                  <li key={s.slot_start}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onPick(dateKey, s)}
                      className={`min-h-11 w-full rounded-md border px-1 text-[15px] font-medium transition-colors motion-reduce:transition-none ${
                        selected ? 'border-ink bg-ink text-ivory' : 'border-line-strong bg-surface hover:border-ink'
                      }`}
                    >
                      {formatTime(s.slot_start, tz)}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {viewerTz !== tz && (
        <p className="text-sm text-muted">Las horas se muestran en la zona horaria del negocio ({tz.replace(/_/g, ' ')}).</p>
      )}
    </div>
  )
}
