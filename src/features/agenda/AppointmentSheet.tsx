import { useEffect, useState } from 'react'
import { Mail, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAsyncData } from '@/lib/hooks'
import { humanError } from '@/lib/errors'
import { formatInstant, formatTime } from '@/lib/dates'
import { formatDuration, formatMoney } from '@/lib/format'
import type { Appointment, AppointmentReference, AppointmentStatus } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { Loading, Notice } from '@/components/ui/States'
import { Sheet } from '@/components/ui/Sheet'
import { StatusBadge } from '@/components/ui/StatusBadge'

type Photo = AppointmentReference & { url: string | null }

/** Detalle de una cita con acciones de estado, notas internas y fotos de referencia (URLs firmadas temporales). */
export function AppointmentSheet({
  appt,
  tz,
  onClose,
  onChanged,
}: {
  appt: Appointment | null
  tz: string
  onClose: () => void
  onChanged: (a: Appointment) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)

  useEffect(() => {
    setConfirmCancel(false)
    setError(null)
    setNoteSaved(false)
    setNote(appt?.internal_notes ?? '')
  }, [appt?.id, appt?.internal_notes])

  // Las fotos son privadas: se piden con URL firmada que caduca a los 10 minutos.
  const photos = useAsyncData(async () => {
    if (!appt) return [] as Photo[]
    const r = await supabase.from('appointment_references').select('*').eq('appointment_id', appt.id).order('created_at')
    if (r.error) throw r.error
    const rows = (r.data ?? []) as AppointmentReference[]
    if (rows.length === 0) return [] as Photo[]
    const signed = await supabase.storage.from('appointment-references').createSignedUrls(
      rows.map((x) => x.storage_path),
      600,
    )
    const urlByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]))
    return rows.map((x) => ({ ...x, url: urlByPath.get(x.storage_path) ?? null }))
  }, [appt?.id])

  async function patch(label: string, changes: Record<string, unknown>) {
    if (!appt) return
    setBusy(label)
    setError(null)
    const r = await supabase.from('appointments').update(changes).eq('id', appt.id).select().single()
    setBusy(null)
    if (r.error) return setError(humanError(r.error))
    setConfirmCancel(false)
    onChanged(r.data as Appointment)
  }

  const setStatus = (status: AppointmentStatus) =>
    patch(status, {
      status,
      ...(status === 'confirmed' ? { expires_at: null } : {}),
      ...(status === 'cancelled' ? { cancelled_at: new Date().toISOString(), cancelled_by: 'business' } : {}),
    })

  async function saveNote() {
    await patch('note', { internal_notes: note.trim() || null })
    setNoteSaved(true)
  }

  const active = appt && (appt.status === 'pending' || appt.status === 'confirmed')
  const minutes = appt ? Math.round((new Date(appt.end_at).getTime() - new Date(appt.start_at).getTime()) / 60000) : 0

  return (
    <Sheet
      open={!!appt}
      onClose={onClose}
      title={appt?.customer_name ?? 'Cita'}
      footer={
        appt && active ? (
          confirmCancel ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">¿Cancelar esta cita? El horario quedará libre.</p>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setConfirmCancel(false)} disabled={busy !== null}>
                  Volver
                </Button>
                <Button variant="danger" className="flex-1" loading={busy === 'cancelled'} onClick={() => setStatus('cancelled')}>
                  Sí, cancelar cita
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {appt.status === 'pending' && (
                <Button className="flex-1" loading={busy === 'confirmed'} onClick={() => setStatus('confirmed')}>
                  Confirmar
                </Button>
              )}
              {appt.status === 'confirmed' && (
                <>
                  <Button className="flex-1" loading={busy === 'completed'} onClick={() => setStatus('completed')}>
                    Marcar completada
                  </Button>
                  <Button variant="secondary" loading={busy === 'no_show'} onClick={() => setStatus('no_show')}>
                    No asistió
                  </Button>
                </>
              )}
              <Button variant="danger" onClick={() => setConfirmCancel(true)}>
                Cancelar
              </Button>
            </div>
          )
        ) : undefined
      }
    >
      {appt && (
        <div className="space-y-6">
          <div>
            <StatusBadge status={appt.status} />
            <p className="mt-3 font-display text-3xl capitalize leading-tight">
              {formatInstant(appt.start_at, tz, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p className="mt-1 text-lg">
              {formatTime(appt.start_at, tz)} a {formatTime(appt.end_at, tz)}
            </p>
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Servicio</dt>
              <dd className="text-right font-medium">{appt.service_name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Duración</dt>
              <dd className="font-medium">{formatDuration(minutes)}</dd>
            </div>
            {appt.price_cents > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Precio</dt>
                <dd className="font-medium">{formatMoney(appt.price_cents, appt.currency)}</dd>
              </div>
            )}
            {appt.status === 'pending' && appt.expires_at && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Confirmar antes de</dt>
                <dd className="text-right font-medium">
                  {formatInstant(appt.expires_at, tz, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                </dd>
              </div>
            )}
          </dl>

          <div className="space-y-2 border-t border-line pt-5">
            <h3 className="font-display text-xl">Cliente</h3>
            <p className="font-medium">{appt.customer_name}</p>
            <a href={`tel:${appt.customer_phone}`} className="flex min-h-11 items-center gap-2.5 text-sm underline underline-offset-4">
              <Phone className="size-4 text-muted" aria-hidden /> {appt.customer_phone}
            </a>
            <a href={`mailto:${appt.customer_email}`} className="flex min-h-11 items-center gap-2.5 break-all text-sm underline underline-offset-4">
              <Mail className="size-4 shrink-0 text-muted" aria-hidden /> {appt.customer_email}
            </a>
          </div>

          {appt.notes && (
            <div className="border-t border-line pt-5">
              <h3 className="font-display text-xl">Indicaciones del cliente</h3>
              <p className="mt-2 whitespace-pre-line">{appt.notes}</p>
            </div>
          )}

          <div className="border-t border-line pt-5">
            <h3 className="font-display text-xl">Fotos de referencia</h3>
            {photos.loading && !photos.data ? (
              <Loading />
            ) : photos.error ? (
              <p className="mt-2 text-sm text-bad">{photos.error}</p>
            ) : (photos.data ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-muted">El cliente no adjuntó fotos.</p>
            ) : (
              <ul className="mt-3 grid grid-cols-3 gap-2">
                {(photos.data ?? []).map((p, i) => (
                  <li key={p.id} className="aspect-square overflow-hidden rounded-md border border-line bg-paper">
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer" aria-label={`Abrir foto ${i + 1} en tamaño completo`}>
                        <img src={p.url} alt={`Referencia ${i + 1}`} loading="lazy" className="size-full object-cover" />
                      </a>
                    ) : (
                      <span className="grid size-full place-items-center p-2 text-center text-xs text-muted">No disponible</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-line pt-5">
            <Textarea
              label="Notas internas"
              hint="Solo las ve tu equipo."
              value={note}
              maxLength={1000}
              onChange={(e) => {
                setNote(e.target.value)
                setNoteSaved(false)
              }}
            />
            <div className="mt-2 flex items-center gap-3">
              <Button variant="secondary" onClick={saveNote} loading={busy === 'note'} disabled={note === (appt.internal_notes ?? '')}>
                Guardar nota
              </Button>
              {noteSaved && <span className="text-sm text-ok">Guardada</span>}
            </div>
          </div>

          {error && <Notice>{error}</Notice>}
        </div>
      )}
    </Sheet>
  )
}
