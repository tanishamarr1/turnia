import { addDays, dateKeyInTz, dayRangeUtc, formatKey, minutesSince, timeParts } from '@/lib/dates'
import type { Appointment, Blocked } from '@/lib/types'
import { STATUS_STRIPE } from '@/components/ui/StatusBadge'

const HOUR_PX = 56

/** Agenda semanal (escritorio): columnas por día, citas posicionadas según su hora. */
export function WeekGrid({
  weekStart,
  appts,
  blocks,
  tz,
  today,
  onOpen,
  onPickDay,
}: {
  weekStart: string
  appts: Appointment[]
  blocks: Blocked[]
  tz: string
  today: string
  onOpen: (a: Appointment) => void
  onPickDay: (key: string) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const ranges = days.map((d) => dayRangeUtc(d, tz))

  // Rango horario visible: 8:00 a 20:00 por defecto, ampliado si hay citas fuera de él.
  let startHour = 8
  let endHour = 20
  appts.forEach((a) => {
    const di = days.indexOf(dateKeyInTz(a.start_at, tz))
    if (di < 0) return
    const s = minutesSince(ranges[di].from, a.start_at) / 60
    const e = minutesSince(ranges[di].from, a.end_at) / 60
    startHour = Math.min(startHour, Math.floor(s))
    endHour = Math.max(endHour, Math.ceil(Math.min(e, 24)))
  })
  const total = (endHour - startHour) * HOUR_PX
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-line">
        <span />
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onPickDay(d)}
            className={`min-h-14 border-l border-line px-1 py-2 text-center hover:bg-paper ${d === today ? 'bg-clay-soft' : ''}`}
            aria-label={`Abrir ${formatKey(d, { weekday: 'long', day: 'numeric', month: 'long' })}`}
          >
            <span className="block text-xs capitalize text-muted">{formatKey(d, { weekday: 'short' })}</span>
            <span className="font-display text-xl">{Number(d.slice(8))}</span>
          </button>
        ))}
      </div>

      <div className="max-h-[calc(100dvh-17rem)] min-h-96 overflow-y-auto">
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]" style={{ height: total }}>
          <div className="relative">
            {hours.map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-xs text-muted first:translate-y-0"
                style={{ top: (h - startHour) * HOUR_PX }}
              >
                {h === 0 ? '12 a. m.' : h < 12 ? `${h} a. m.` : h === 12 ? '12 p. m.' : `${h - 12} p. m.`}
              </span>
            ))}
          </div>

          {days.map((d, di) => {
            const r = ranges[di]
            const dayAppts = appts.filter((a) => dateKeyInTz(a.start_at, tz) === d)
            const dayBlocks = blocks.filter((b) => b.start_at < r.to && b.end_at > r.from)
            return (
              <div
                key={d}
                className="relative border-l border-line"
                style={{
                  backgroundImage: 'linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)',
                  backgroundSize: `100% ${HOUR_PX}px`,
                }}
              >
                {dayBlocks.map((b) => {
                  const top = Math.max(0, minutesSince(r.from, b.start_at) / 60 - startHour) * HOUR_PX
                  const bottom = Math.min(endHour - startHour, minutesSince(r.from, b.end_at) / 60 - startHour) * HOUR_PX
                  if (bottom <= 0 || top >= total) return null
                  return (
                    <div
                      key={b.id}
                      className="absolute inset-x-0 overflow-hidden bg-line/70 px-1.5 py-1 text-[11px] text-muted"
                      style={{ top, height: Math.max(bottom - top, 16) }}
                      title={b.reason ?? 'Bloqueado'}
                    >
                      {b.reason ?? 'Bloqueado'}
                    </div>
                  )
                })}
                {dayAppts.map((a) => {
                  const top = (minutesSince(r.from, a.start_at) / 60 - startHour) * HOUR_PX
                  const height = Math.max(22, (minutesSince(a.start_at, a.end_at) / 60) * HOUR_PX - 2)
                  const dim = a.status === 'cancelled' || a.status === 'expired'
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onOpen(a)}
                      className={`absolute inset-x-1 overflow-hidden rounded-sm border-l-4 bg-paper px-1.5 py-1 text-left text-xs shadow-[0_0_0_1px_var(--color-line)] hover:bg-clay-soft ${STATUS_STRIPE[a.status]} ${dim ? 'opacity-60' : ''}`}
                      style={{ top, height }}
                      aria-label={`${a.customer_name}, ${a.service_name}, ${timeParts(a.start_at, tz).clock} ${timeParts(a.start_at, tz).period}`}
                    >
                      <span className={`block truncate font-semibold ${dim ? 'line-through' : ''}`}>{a.customer_name}</span>
                      {height > 36 && <span className="block truncate text-muted">{a.service_name}</span>}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
