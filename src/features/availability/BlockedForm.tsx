import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { humanError } from '@/lib/errors'
import { addDays, zonedToUtc } from '@/lib/dates'
import type { Business } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Notice } from '@/components/ui/States'

/**
 * Crea un bloqueo: unas horas de un día, o uno o varios días completos (día libre / vacaciones).
 * Los bloqueos se guardan como rangos de instantes calculados con la zona horaria del negocio.
 */
export function BlockedForm({
  business,
  defaultDate,
  onDone,
}: {
  business: Business
  defaultDate: string
  onDone: () => void
}) {
  const { user } = useAuth()
  const tz = business.timezone
  const [mode, setMode] = useState<'time' | 'days'>('time')
  const [from, setFrom] = useState(defaultDate)
  const [to, setTo] = useState(defaultDate)
  const [start, setStart] = useState('12:00')
  const [end, setEnd] = useState('13:00')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<number | null>(null)

  async function save(force: boolean) {
    setError(null)
    let startAt: Date
    let endAt: Date
    if (mode === 'time') {
      startAt = zonedToUtc(from, start, tz)
      endAt = zonedToUtc(from, end, tz)
      if (endAt <= startAt) return setError('La hora final debe ser posterior a la inicial.')
    } else {
      if (to < from) return setError('La fecha final no puede ser anterior a la inicial.')
      startAt = zonedToUtc(from, '00:00', tz)
      endAt = zonedToUtc(addDays(to, 1), '00:00', tz)
    }

    setBusy(true)
    try {
      if (!force) {
        const c = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', business.id)
          .in('status', ['pending', 'confirmed'])
          .lt('start_at', endAt.toISOString())
          .gt('end_at', startAt.toISOString())
        if (c.error) throw c.error
        if ((c.count ?? 0) > 0) {
          setConflicts(c.count ?? 0)
          return
        }
      }
      const r = await supabase.from('blocked_dates').insert({
        business_id: business.id,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        kind: mode === 'time' ? 'time_block' : from === to ? 'day_off' : 'vacation',
        reason: reason.trim() || null,
        created_by: user?.id ?? null,
      })
      if (r.error) throw r.error
      onDone()
    } catch (e) {
      setError(humanError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        save(conflicts !== null)
      }}
    >
      <div role="group" aria-label="Tipo de bloqueo" className="grid grid-cols-2 gap-1 rounded-md bg-line p-1">
        {(
          [
            ['time', 'Unas horas'],
            ['days', 'Días completos'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={mode === key}
            onClick={() => {
              setMode(key)
              setConflicts(null)
            }}
            className={`min-h-11 rounded-sm text-sm font-medium ${mode === key ? 'bg-surface shadow-sm' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'time' ? (
        <>
          <Input label="Fecha" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setConflicts(null) }} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Desde" type="time" value={start} onChange={(e) => { setStart(e.target.value); setConflicts(null) }} required />
            <Input label="Hasta" type="time" value={end} onChange={(e) => { setEnd(e.target.value); setConflicts(null) }} required />
          </div>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Primer día" type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); setConflicts(null) }} required />
          <Input label="Último día" type="date" min={from} value={to} onChange={(e) => { setTo(e.target.value); setConflicts(null) }} required />
        </div>
      )}

      <Input label="Motivo (opcional)" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} hint="Solo lo ve tu equipo." />

      {conflicts !== null && (
        <Notice tone="warn">
          Hay {conflicts} {conflicts === 1 ? 'cita activa' : 'citas activas'} en ese rango. Bloquear no las cancela: tendrás que gestionarlas en la agenda.
        </Notice>
      )}
      {error && <Notice>{error}</Notice>}

      <Button type="submit" full loading={busy}>
        {conflicts !== null ? 'Bloquear de todos modos' : 'Bloquear'}
      </Button>
    </form>
  )
}
