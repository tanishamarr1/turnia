import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, formatKey, monthCells, monthStart } from '@/lib/dates'
import { IconButton } from './Button'

const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/**
 * Calendario mensual táctil (semana desde el lunes).
 * - isEnabled: qué días se pueden elegir. marks: número de citas por día (agenda).
 * - roomy: celdas amplias para tableta y escritorio.
 */
export function Calendar({
  month,
  onMonthChange,
  selected,
  today,
  onSelect,
  isEnabled,
  highlight,
  marks,
  roomy,
  canPrev = true,
  canNext = true,
  busy,
}: {
  month: string
  onMonthChange: (key: string) => void
  selected?: string | null
  today: string
  onSelect: (key: string) => void
  isEnabled?: (key: string) => boolean
  highlight?: (key: string) => boolean
  marks?: Record<string, number>
  roomy?: boolean
  canPrev?: boolean
  canNext?: boolean
  busy?: boolean
}) {
  const cells = monthCells(month)
  const title = formatKey(monthStart(month), { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <IconButton label="Mes anterior" onClick={() => onMonthChange(addMonths(month, -1))} disabled={!canPrev}>
          <ChevronLeft />
        </IconButton>
        <h3 className="font-display text-xl capitalize" aria-live="polite">
          {title}
        </h3>
        <IconButton label="Mes siguiente" onClick={() => onMonthChange(addMonths(month, 1))} disabled={!canNext}>
          <ChevronRight />
        </IconButton>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted" aria-hidden>
        {WEEK.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>

      <div className={`mt-1 grid grid-cols-7 gap-1 transition-opacity motion-reduce:transition-none ${busy ? 'opacity-60' : ''}`}>
        {cells.map((key, i) => {
          if (!key) return <span key={`e${i}`} />
          const enabled = isEnabled ? isEnabled(key) : true
          const isSel = key === selected
          const isToday = key === today
          const count = marks?.[key] ?? 0
          const day = Number(key.slice(8))
          const label = formatKey(key, { weekday: 'long', day: 'numeric', month: 'long' })
          return (
            <button
              key={key}
              type="button"
              disabled={!enabled}
              aria-pressed={isSel}
              aria-label={count ? `${label}, ${count} ${count === 1 ? 'cita' : 'citas'}` : label}
              onClick={() => onSelect(key)}
              className={[
                'relative flex rounded-md text-sm transition-colors motion-reduce:transition-none',
                roomy ? 'min-h-20 flex-col items-start justify-between p-2' : 'aspect-square min-h-11 flex-col items-center justify-center',
                isSel
                  ? 'bg-ink text-ivory'
                  : enabled
                    ? `font-semibold hover:bg-ink/5 ${highlight?.(key) ? 'bg-clay-soft' : ''}`
                    : 'cursor-not-allowed text-muted/45',
                isToday && !isSel ? 'ring-1 ring-inset ring-ink' : '',
              ].join(' ')}
            >
              <span>{day}</span>
              {roomy && count > 0 && (
                <span className={`text-xs font-medium ${isSel ? 'text-ivory/80' : 'text-clay-strong'}`}>
                  {count} {count === 1 ? 'cita' : 'citas'}
                </span>
              )}
              {!roomy && count > 0 && (
                <span className={`absolute bottom-1.5 size-1 rounded-full ${isSel ? 'bg-ivory' : 'bg-clay-strong'}`} aria-hidden />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
