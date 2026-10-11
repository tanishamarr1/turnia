import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAsyncData, useMediaQuery } from '@/lib/hooks'
import {
  addDays, addMonths, dateKeyInTz, dayRangeUtc, formatDayLong, formatInstant, formatKey, formatTime,
  startOfWeek, todayKey, zonedToUtc, monthStart,
} from '@/lib/dates'
import type { Appointment, AppointmentStatus, Blocked } from '@/lib/types'
import { Button, IconButton } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { Calendar } from '@/components/ui/Calendar'
import { EmptyState, ErrorState, Loading } from '@/components/ui/States'
import { Sheet } from '@/components/ui/Sheet'
import { useBusiness } from '../admin/BusinessContext'
import { BlockedForm } from '../availability/BlockedForm'
import { AppointmentRow } from './AppointmentRow'
import { AppointmentSheet } from './AppointmentSheet'
import { WeekGrid } from './WeekGrid'

type View = 'day' | 'week' | 'month'
const ACTIVE: AppointmentStatus[] = ['pending', 'confirmed', 'completed', 'no_show']

/**
 * Móvil: solo vista diaria (lista cronológica). Tableta: día + mes con calendario lateral.
 * Escritorio: día, semana (rejilla por horas) y mes.
 */
export default function AgendaPage() {
  const { business } = useBusiness()
  const tz = business.timezone
  const isMd = useMediaQuery('(min-width: 768px)')
  const isLg = useMediaQuery('(min-width: 1024px)')

  const [view, setView] = useState<View>('day')
  const [date, setDate] = useState(() => todayKey(tz))
  const [statusFilter, setStatusFilter] = useState('active')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [blockOpen, setBlockOpen] = useState(false)
  const [selBlock, setSelBlock] = useState<Blocked | null>(null)

  const eff: View = view === 'week' && !isLg ? 'day' : view === 'month' && !isMd ? 'day' : view
  const today = todayKey(tz)

  const range = useMemo(() => {
    if (eff === 'day') return dayRangeUtc(date, tz)
    if (eff === 'week') {
      const s = startOfWeek(date)
      return { from: zonedToUtc(s, '00:00', tz).toISOString(), to: zonedToUtc(addDays(s, 7), '00:00', tz).toISOString() }
    }
    const s = startOfWeek(monthStart(date))
    return { from: zonedToUtc(s, '00:00', tz).toISOString(), to: zonedToUtc(addDays(s, 42), '00:00', tz).toISOString() }
  }, [eff, date, tz])

  const data = useAsyncData(async () => {
    const [a, b, s] = await Promise.all([
      supabase.from('appointments').select('*').eq('business_id', business.id).gte('start_at', range.from).lt('start_at', range.to).order('start_at'),
      supabase.from('blocked_dates').select('*').eq('business_id', business.id).lt('start_at', range.to).gt('end_at', range.from).order('start_at'),
      supabase.from('services').select('id,name').eq('business_id', business.id).order('sort_order'),
    ])
    if (a.error) throw a.error
    if (b.error) throw b.error
    if (s.error) throw s.error
    return {
      appts: (a.data ?? []) as Appointment[],
      blocks: (b.data ?? []) as Blocked[],
      services: (s.data ?? []) as { id: string; name: string }[],
    }
  }, [business.id, range.from, range.to])

  const appts = useMemo(
    () =>
      (data.data?.appts ?? []).filter(
        (a) =>
          (statusFilter === 'active' ? ACTIVE.includes(a.status) : a.status === statusFilter) &&
          (serviceFilter === 'all' || a.service_id === serviceFilter),
      ),
    [data.data, statusFilter, serviceFilter],
  )
  const blocks = data.data?.blocks ?? []

  const step = (dir: 1 | -1) =>
    setDate(eff === 'day' ? addDays(date, dir) : eff === 'week' ? addDays(date, 7 * dir) : addMonths(date, dir))

  const title =
    eff === 'day'
      ? formatDayLong(date)
      : eff === 'week'
        ? `${formatKey(startOfWeek(date), { day: 'numeric', month: 'short' })} al ${formatKey(addDays(startOfWeek(date), 6), { day: 'numeric', month: 'short' })}`
        : formatKey(date, { month: 'long', year: 'numeric' })

  const marks = useMemo(() => {
    const m: Record<string, number> = {}
    appts.forEach((a) => {
      if (a.status === 'cancelled' || a.status === 'expired') return
      const k = dateKeyInTz(a.start_at, tz)
      m[k] = (m[k] ?? 0) + 1
    })
    return m
  }, [appts, tz])

  const dayAppts = appts.filter((a) => dateKeyInTz(a.start_at, tz) === date)
  const dayR = dayRangeUtc(date, tz)
  const dayBlocks = blocks.filter((b) => b.start_at < dayR.to && b.end_at > dayR.from)

  // Línea de tiempo del día: citas y bloqueos mezclados por hora de inicio.
  const timeline = [
    ...dayAppts.map((a) => ({ kind: 'appt' as const, at: a.start_at, a })),
    ...dayBlocks.map((b) => ({ kind: 'block' as const, at: b.start_at < dayR.from ? dayR.from : b.start_at, b })),
  ].sort((x, y) => x.at.localeCompare(y.at))

  function onChanged(a: Appointment) {
    setSelected(a)
    data.reload()
  }

  const dayList = (
    <div>
      {timeline.length === 0 ? (
        <EmptyState
          title="Día libre de citas"
          text="No hay citas con estos filtros. Comparte tu enlace para recibir reservas."
          action={<Button variant="secondary" onClick={() => setBlockOpen(true)}>Bloquear horario</Button>}
        />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {timeline.map((it) =>
            it.kind === 'appt' ? (
              <li key={it.a.id}>
                <AppointmentRow appt={it.a} tz={tz} onOpen={setSelected} />
              </li>
            ) : (
              <li key={it.b.id}>
                <button
                  type="button"
                  onClick={() => setSelBlock(it.b)}
                  className="flex min-h-14 w-full items-center gap-3 border-l-4 border-line-strong bg-line/40 py-3 pl-3 pr-2 text-left hover:bg-line/70"
                >
                  <Lock className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-medium">{it.b.reason ?? 'Horario bloqueado'}</span>
                    <span className="block text-sm text-muted">
                      {it.b.kind === 'time_block'
                        ? `${formatTime(it.b.start_at, tz)} a ${formatTime(it.b.end_at, tz)}`
                        : 'Todo el día'}
                    </span>
                  </span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl">Agenda</h1>
        <Button variant="secondary" onClick={() => setBlockOpen(true)}>
          <Lock className="size-4" aria-hidden /> Bloquear horario
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <IconButton label="Anterior" onClick={() => step(-1)}>
          <ChevronLeft />
        </IconButton>
        <h2 className="min-w-0 flex-1 text-center font-display text-xl capitalize md:flex-none md:px-2 md:text-left md:text-2xl">{title}</h2>
        <IconButton label="Siguiente" onClick={() => step(1)}>
          <ChevronRight />
        </IconButton>
        <Button variant="secondary" onClick={() => setDate(today)} disabled={date === today && eff === 'day'}>
          Hoy
        </Button>

        {isMd && (
          <div role="group" aria-label="Vista" className="ml-auto grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-line p-1">
            {(
              [
                ['day', 'Día', true],
                ['week', 'Semana', isLg],
                ['month', 'Mes', isMd],
              ] as const
            )
              .filter(([, , ok]) => ok)
              .map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={eff === key}
                  onClick={() => setView(key)}
                  className={`min-h-9 rounded-sm px-4 text-sm font-medium ${eff === key ? 'bg-surface shadow-sm' : 'text-muted'}`}
                >
                  {label}
                </button>
              ))}
          </div>
        )}
      </div>

      {eff === 'day' && !isMd && (
        <div className="grid grid-cols-7 gap-1" role="group" aria-label="Días de la semana">
          {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date), i)).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={k === date}
              onClick={() => setDate(k)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-md ${k === date ? 'bg-ink text-ivory' : k === today ? 'ring-1 ring-inset ring-ink' : 'hover:bg-ink/5'}`}
            >
              <span className="text-[11px] capitalize opacity-80">{formatKey(k, { weekday: 'narrow' })}</span>
              <span className="font-display text-lg leading-none">{Number(k.slice(8))}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 md:max-w-xl">
        <Select label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="active">Activas</option>
          <option value="pending">Pendientes</option>
          <option value="confirmed">Confirmadas</option>
          <option value="completed">Completadas</option>
          <option value="cancelled">Canceladas</option>
          <option value="no_show">No asistió</option>
          <option value="expired">Expiradas</option>
        </Select>
        <Select label="Servicio" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
          <option value="all">Todos</option>
          {(data.data?.services ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      {data.loading && !data.data ? (
        <Loading />
      ) : data.error && !data.data ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : (
        <div className={data.loading ? 'opacity-70 transition-opacity' : ''}>
          {eff === 'day' && (
            <div className="md:grid md:grid-cols-[minmax(0,1fr)_19rem] md:items-start md:gap-8">
              {dayList}
              <div className="mt-8 hidden md:sticky md:top-24 md:mt-0 md:block">
                <Calendar month={date} onMonthChange={setDate} selected={date} today={today} onSelect={setDate} marks={marks} />
              </div>
            </div>
          )}
          {eff === 'week' && (
            <WeekGrid
              weekStart={startOfWeek(date)}
              appts={appts}
              blocks={blocks}
              tz={tz}
              today={today}
              onOpen={setSelected}
              onPickDay={(k) => {
                setDate(k)
                setView('day')
              }}
            />
          )}
          {eff === 'month' && (
            <div className="max-w-3xl">
              <Calendar
                month={date}
                onMonthChange={setDate}
                selected={date}
                today={today}
                roomy
                marks={marks}
                onSelect={(k) => {
                  setDate(k)
                  setView('day')
                }}
              />
            </div>
          )}
        </div>
      )}

      <AppointmentSheet appt={selected} tz={tz} onClose={() => setSelected(null)} onChanged={onChanged} />

      <Sheet open={blockOpen} onClose={() => setBlockOpen(false)} title="Bloquear horario">
        <BlockedForm
          business={business}
          defaultDate={date}
          onDone={() => {
            setBlockOpen(false)
            data.reload()
          }}
        />
      </Sheet>

      <Sheet
        open={!!selBlock}
        onClose={() => setSelBlock(null)}
        title="Bloqueo"
        footer={
          <Button
            variant="danger"
            full
            onClick={async () => {
              if (!selBlock) return
              const r = await supabase.from('blocked_dates').delete().eq('id', selBlock.id)
              if (!r.error) {
                setSelBlock(null)
                data.reload()
              }
            }}
          >
            Quitar bloqueo
          </Button>
        }
      >
        {selBlock && (
          <div className="space-y-2">
            <p className="font-display text-2xl">{selBlock.reason ?? 'Horario bloqueado'}</p>
            <p className="text-muted">
              {formatInstant(selBlock.start_at, tz, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} hasta{' '}
              {formatInstant(selBlock.end_at, tz, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
        )}
      </Sheet>
    </div>
  )
}
