import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAsyncData } from '@/lib/hooks'
import { humanError } from '@/lib/errors'
import { formatInstant, todayKey } from '@/lib/dates'
import type { Blocked, HourRow } from '@/lib/types'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { EmptyState, ErrorState, Loading, Notice } from '@/components/ui/States'
import { Sheet } from '@/components/ui/Sheet'
import { useBusiness } from '../admin/BusinessContext'
import { HoursEditor } from './HoursEditor'
import { BlockedForm } from './BlockedForm'
import { rowsToWeek, validateWeek, weekToRows, type Week } from './hours'

export default function AvailabilityPage() {
  const { business, refresh } = useBusiness()
  const tz = business.timezone

  const hours = useAsyncData(async () => {
    const r = await supabase.from('business_hours').select('weekday,kind,start_time,end_time').eq('business_id', business.id)
    if (r.error) throw r.error
    return (r.data ?? []) as HourRow[]
  }, [business.id])

  const blocks = useAsyncData(async () => {
    const r = await supabase
      .from('blocked_dates')
      .select('*')
      .eq('business_id', business.id)
      .gte('end_at', new Date().toISOString())
      .order('start_at')
    if (r.error) throw r.error
    return (r.data ?? []) as Blocked[]
  }, [business.id])

  // --- Horario semanal ---
  const [week, setWeek] = useState<Week | null>(null)
  const [hoursMsg, setHoursMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [savingHours, setSavingHours] = useState(false)
  useEffect(() => {
    if (hours.data && !week) setWeek(rowsToWeek(hours.data))
  }, [hours.data, week])

  async function saveHours() {
    if (!week) return
    const problem = validateWeek(week)
    if (problem) return setHoursMsg({ tone: 'error', text: problem })
    setSavingHours(true)
    setHoursMsg(null)
    const r = await supabase.rpc('replace_business_hours', { p_business_id: business.id, p_hours: weekToRows(week) })
    setSavingHours(false)
    setHoursMsg(r.error ? { tone: 'error', text: humanError(r.error) } : { tone: 'ok', text: 'Horario guardado.' })
  }

  // --- Reglas de reserva ---
  const [rules, setRules] = useState({
    noticeHours: String(Math.round(business.min_notice_minutes / 60)),
    advanceDays: String(business.max_advance_days),
    buffer: String(business.buffer_minutes),
    step: String(business.slot_step_minutes),
  })
  const [rulesMsg, setRulesMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [savingRules, setSavingRules] = useState(false)

  async function saveRules() {
    const notice = Number(rules.noticeHours)
    const advance = Number(rules.advanceDays)
    const buffer = Number(rules.buffer)
    if (![notice, advance, buffer].every(Number.isFinite) || notice < 0 || notice > 720 || advance < 1 || advance > 365 || buffer < 0 || buffer > 240) {
      return setRulesMsg({ tone: 'error', text: 'Revisa los valores: anticipación 0 a 720 h, días 1 a 365, tiempo extra 0 a 240 min.' })
    }
    setSavingRules(true)
    setRulesMsg(null)
    const r = await supabase
      .from('businesses')
      .update({
        min_notice_minutes: Math.round(notice * 60),
        max_advance_days: Math.round(advance),
        buffer_minutes: Math.round(buffer),
        slot_step_minutes: Number(rules.step),
      })
      .eq('id', business.id)
    setSavingRules(false)
    if (r.error) return setRulesMsg({ tone: 'error', text: humanError(r.error) })
    setRulesMsg({ tone: 'ok', text: 'Reglas guardadas.' })
    refresh()
  }

  // --- Bloqueos ---
  const [blockOpen, setBlockOpen] = useState(false)
  async function removeBlock(id: string) {
    const r = await supabase.from('blocked_dates').delete().eq('id', id)
    if (!r.error) blocks.reload()
  }

  return (
    <div className="space-y-12">
      <header>
        <h1 className="font-display text-4xl">Horarios y disponibilidad</h1>
        <p className="mt-2 max-w-prose text-muted">
          Tus clientes solo podrán reservar dentro de estas reglas. Las horas se guardan en la zona {tz.replace(/_/g, ' ')}.
        </p>
      </header>

      <section aria-labelledby="h-week" className="max-w-2xl">
        <h2 id="h-week" className="font-display text-2xl">
          Horario semanal
        </h2>
        <div className="mt-3">
          {hours.loading && !week ? (
            <Loading />
          ) : hours.error ? (
            <ErrorState message={hours.error} onRetry={hours.reload} />
          ) : (
            week && <HoursEditor value={week} onChange={(w) => { setWeek(w); setHoursMsg(null) }} />
          )}
        </div>
        {hoursMsg && (
          <div className="mt-4">
            <Notice tone={hoursMsg.tone}>{hoursMsg.text}</Notice>
          </div>
        )}
        <Button className="mt-4 w-full sm:w-auto" onClick={saveHours} loading={savingHours} disabled={!week}>
          Guardar horario
        </Button>
      </section>

      <section aria-labelledby="h-rules" className="max-w-2xl">
        <h2 id="h-rules" className="font-display text-2xl">
          Reglas de reserva
        </h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Input
            label="Anticipación mínima (horas)"
            type="number"
            inputMode="numeric"
            min={0}
            max={720}
            value={rules.noticeHours}
            onChange={(e) => setRules({ ...rules, noticeHours: e.target.value })}
            hint="Con cuánto tiempo antes se puede reservar."
          />
          <Input
            label="Días futuros reservables"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={rules.advanceDays}
            onChange={(e) => setRules({ ...rules, advanceDays: e.target.value })}
            hint="Hasta cuántos días adelante se muestran fechas."
          />
          <Input
            label="Tiempo extra entre citas (min)"
            type="number"
            inputMode="numeric"
            min={0}
            max={240}
            value={rules.buffer}
            onChange={(e) => setRules({ ...rules, buffer: e.target.value })}
            hint="Para preparar o limpiar entre una cita y otra."
          />
          <Select label="Intervalo entre horas ofrecidas" value={rules.step} onChange={(e) => setRules({ ...rules, step: e.target.value })}>
            {[5, 10, 15, 20, 30, 60].map((m) => (
              <option key={m} value={m}>
                Cada {m} minutos
              </option>
            ))}
          </Select>
        </div>
        {rulesMsg && (
          <div className="mt-4">
            <Notice tone={rulesMsg.tone}>{rulesMsg.text}</Notice>
          </div>
        )}
        <Button className="mt-4 w-full sm:w-auto" onClick={saveRules} loading={savingRules}>
          Guardar reglas
        </Button>
      </section>

      <section aria-labelledby="h-blocks" className="max-w-2xl">
        <div className="flex items-end justify-between gap-3">
          <h2 id="h-blocks" className="font-display text-2xl">
            Días libres, vacaciones y bloqueos
          </h2>
          <Button variant="secondary" onClick={() => setBlockOpen(true)}>
            <Plus className="size-4" aria-hidden /> Añadir
          </Button>
        </div>

        <div className="mt-3">
          {blocks.loading && !blocks.data ? (
            <Loading />
          ) : blocks.error ? (
            <ErrorState message={blocks.error} onRetry={blocks.reload} />
          ) : (blocks.data ?? []).length === 0 ? (
            <EmptyState title="Sin bloqueos próximos" text="Añade un día libre, tus vacaciones o un rato en que no atiendes." />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {(blocks.data ?? []).map((b) => {
                const sameDay = formatInstant(b.start_at, tz, { dateStyle: 'short' }) === formatInstant(new Date(new Date(b.end_at).getTime() - 1).toISOString(), tz, { dateStyle: 'short' })
                const allDay = b.kind !== 'time_block'
                const label = allDay
                  ? sameDay
                    ? formatInstant(b.start_at, tz, { weekday: 'long', day: 'numeric', month: 'long' })
                    : `${formatInstant(b.start_at, tz, { day: 'numeric', month: 'short' })} al ${formatInstant(new Date(new Date(b.end_at).getTime() - 1).toISOString(), tz, { day: 'numeric', month: 'short' })}`
                  : `${formatInstant(b.start_at, tz, { weekday: 'short', day: 'numeric', month: 'short' })}, ${formatInstant(b.start_at, tz, { hour: 'numeric', minute: '2-digit' })} a ${formatInstant(b.end_at, tz, { hour: 'numeric', minute: '2-digit' })}`
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2 pl-1">
                    <div className="min-w-0">
                      <p className="font-medium capitalize">{label}</p>
                      <p className="truncate text-sm text-muted">
                        {b.kind === 'vacation' ? 'Vacaciones' : b.kind === 'day_off' ? 'Día libre' : 'Bloqueo de horas'}
                        {b.reason ? `: ${b.reason}` : ''}
                      </p>
                    </div>
                    <IconButton label={`Eliminar bloqueo: ${label}`} onClick={() => removeBlock(b.id)}>
                      <Trash2 />
                    </IconButton>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      <Sheet open={blockOpen} onClose={() => setBlockOpen(false)} title="Nuevo bloqueo">
        <BlockedForm
          business={business}
          defaultDate={todayKey(tz)}
          onDone={() => {
            setBlockOpen(false)
            blocks.reload()
          }}
        />
      </Sheet>
    </div>
  )
}
