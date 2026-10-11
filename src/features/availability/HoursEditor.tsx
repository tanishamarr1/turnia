import { Plus, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { inputClass } from '@/components/ui/Field'
import { Switch } from '@/components/ui/Switch'
import { DAY_NAMES, type DaySchedule, type Interval, type Week } from './hours'

/** Editor del horario semanal. En móvil cada día es un bloque de una columna; los campos de hora ocupan el ancho. */
export function HoursEditor({ value, onChange }: { value: Week; onChange: (w: Week) => void }) {
  const setDay = (ui: number, patch: Partial<DaySchedule>) =>
    onChange(value.map((d, i) => (i === ui ? { ...d, ...patch } : d)))

  return (
    <div className="divide-y divide-line border-y border-line">
      {value.map((day, ui) => (
        <section key={DAY_NAMES[ui]} aria-labelledby={`day-${ui}`} className="py-3">
          <div className="flex min-h-11 items-center justify-between">
            <h3 id={`day-${ui}`} className="font-display text-xl">
              {DAY_NAMES[ui]}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">{day.open ? 'Abierto' : 'Cerrado'}</span>
              <Switch
                label={`${DAY_NAMES[ui]} abierto`}
                checked={day.open}
                onChange={(open) => setDay(ui, { open, work: open && day.work.length === 0 ? [{ start: '09:00', end: '17:00' }] : day.work })}
              />
            </div>
          </div>

          {day.open && (
            <div className="mt-2 space-y-4">
              <IntervalList
                title="Horario de atención"
                addLabel="Añadir turno"
                items={day.work}
                min={1}
                onChange={(work) => setDay(ui, { work })}
                dayName={DAY_NAMES[ui]}
              />
              <IntervalList
                title="Pausas"
                addLabel="Añadir pausa"
                items={day.breaks}
                onChange={(breaks) => setDay(ui, { breaks })}
                dayName={DAY_NAMES[ui]}
              />
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

function IntervalList({
  title,
  addLabel,
  items,
  onChange,
  min = 0,
  dayName,
}: {
  title: string
  addLabel: string
  items: Interval[]
  onChange: (v: Interval[]) => void
  min?: number
  dayName: string
}) {
  const set = (i: number, patch: Partial<Interval>) => onChange(items.map((it, k) => (k === i ? { ...it, ...patch } : it)))
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-1 space-y-2">
        {items.map((it, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2">
            <input
              type="time"
              aria-label={`${title} de ${dayName}, hora inicial ${i + 1}`}
              value={it.start}
              onChange={(e) => set(i, { start: e.target.value })}
              className={`${inputClass} px-2`}
            />
            <span className="text-sm text-muted" aria-hidden>
              a
            </span>
            <input
              type="time"
              aria-label={`${title} de ${dayName}, hora final ${i + 1}`}
              value={it.end}
              onChange={(e) => set(i, { end: e.target.value })}
              className={`${inputClass} px-2`}
            />
            <IconButton
              label={`Quitar ${title.toLowerCase()} ${i + 1} de ${dayName}`}
              disabled={items.length <= min}
              onClick={() => onChange(items.filter((_, k) => k !== i))}
            >
              <Trash2 />
            </IconButton>
          </li>
        ))}
      </ul>
      <Button
        variant="ghost"
        className="-ml-3 mt-1"
        onClick={() => onChange([...items, items.length ? { start: items[items.length - 1].end, end: items[items.length - 1].end } : { start: '12:00', end: '13:00' }])}
      >
        <Plus className="size-4" aria-hidden /> {addLabel}
      </Button>
    </div>
  )
}
