import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { humanError, isSlotError } from '@/lib/errors'
import { formatDayLong, formatTime } from '@/lib/dates'
import { formatDuration, formatMoney } from '@/lib/format'
import { uploadReference } from '@/lib/storage'
import type { PublicBusiness, Service, Slot } from '@/lib/types'
import { ButtonLink } from '@/components/ui/Button'
import { Notice } from '@/components/ui/States'
import { DateTimeStep } from './DateTimeStep'
import { DetailsStep, type Details } from './DetailsStep'
import { ReferencesStep } from './ReferencesStep'
import { StepBar } from './StepBar'

type StepKey = 'service' | 'datetime' | 'details' | 'refs' | 'review'
const TITLES: Record<StepKey, string> = {
  service: 'Elige un servicio',
  datetime: 'Fecha y hora',
  details: 'Tus datos',
  refs: 'Fotos de referencia',
  review: 'Revisa y confirma',
}

/**
 * Flujo de reserva por pasos. Todo el estado vive aquí, así que volver atrás no borra nada.
 * La cita solo se crea en el último paso: no existen reservas a medias que bloqueen horarios.
 */
export function BookingFlow({ business, services }: { business: PublicBusiness; services: Service[] }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const tz = business.timezone
  const topRef = useRef<HTMLHeadingElement>(null)

  const steps = useMemo<StepKey[]>(
    () => ['service', 'datetime', 'details', ...(business.max_reference_images > 0 ? (['refs'] as StepKey[]) : []), 'review'],
    [business.max_reference_images],
  )
  const [index, setIndex] = useState(0)
  const step = steps[index]

  const [service, setService] = useState<Service | null>(null)
  const [dateKey, setDateKey] = useState<string | null>(null)
  const [slot, setSlot] = useState<Slot | null>(null)
  const [details, setDetails] = useState<Details>({ name: '', email: user?.email ?? '', phone: '', notes: '' })
  const [files, setFiles] = useState<File[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [partial, setPartial] = useState<{ token: string; failed: string[] } | null>(null)

  // Al cambiar de paso, devolver el foco al título para lectores de pantalla y evitar perder la posición.
  useEffect(() => {
    if (index > 0) topRef.current?.focus({ preventScroll: false })
  }, [index])

  const go = (d: number) => setIndex((i) => Math.min(Math.max(i + d, 0), steps.length - 1))

  async function submit() {
    if (!service || !slot) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await supabase.rpc('create_booking', {
        p_business_id: business.id,
        p_service_id: service.id,
        p_start: slot.slot_start,
        p_name: details.name,
        p_email: details.email,
        p_phone: details.phone,
        p_notes: details.notes || null,
      })
      if (r.error) throw r.error
      const res = r.data as { appointment_id: string; access_token: string }

      const failed: string[] = []
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length })
        try {
          await uploadReference({ businessId: business.id, appointmentId: res.appointment_id, token: res.access_token, file: files[i] })
        } catch {
          failed.push(files[i].name)
        }
      }
      setProgress(null)

      if (failed.length) setPartial({ token: res.access_token, failed })
      else navigate(`/reserva/${res.access_token}`)
    } catch (e) {
      setProgress(null)
      setError(humanError(e))
      if (isSlotError(e)) {
        // El hueco se ocupó mientras la persona completaba el formulario: volver a elegir hora.
        setSlot(null)
        setIndex(steps.indexOf('datetime'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (partial) {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-3xl">Tu reserva está creada</h2>
        <Notice tone="warn">
          No pudimos subir {partial.failed.length === 1 ? 'una foto' : `${partial.failed.length} fotos`}: {partial.failed.join(', ')}. Puedes
          enviarlas por otro medio al negocio.
        </Notice>
        <ButtonLink to={`/reserva/${partial.token}`}>Ver mi reserva</ButtonLink>
      </div>
    )
  }

  return (
    <section aria-labelledby="flow-title">
      <div className="mb-6">
        <p className="text-sm text-muted" aria-live="polite">
          Paso {index + 1} de {steps.length}
        </p>
        <div className="mt-2 flex gap-1" aria-hidden>
          {steps.map((s, i) => (
            <span key={s} className={`h-1 flex-1 rounded-full ${i <= index ? 'bg-clay-strong' : 'bg-line'}`} />
          ))}
        </div>
        <h2 id="flow-title" ref={topRef} tabIndex={-1} className="mt-4 font-display text-3xl outline-none sm:text-4xl">
          {TITLES[step]}
        </h2>
      </div>

      {error && (
        <div className="mb-5">
          <Notice>{error}</Notice>
        </div>
      )}

      {step === 'service' && (
        <ul>
          {services.map((s) => (
            <li key={s.id} className="border-b border-line first:border-t">
              <button
                type="button"
                onClick={() => {
                  if (service?.id !== s.id) {
                    setSlot(null)
                    setDateKey(null)
                  }
                  setService(s)
                  go(1)
                }}
                className="flex min-h-20 w-full items-center gap-4 py-4 text-left transition-colors hover:bg-paper motion-reduce:transition-none"
              >
                {s.image_url && <img src={s.image_url} alt="" loading="lazy" className="size-16 shrink-0 rounded-md object-cover" />}
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-xl leading-snug">{s.name}</span>
                  {s.description && <span className="mt-1 line-clamp-2 block text-sm text-muted">{s.description}</span>}
                  <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <Clock className="size-4" aria-hidden /> {formatDuration(s.duration_minutes)}
                    </span>
                    {s.price_cents > 0 && <span className="font-semibold">{formatMoney(s.price_cents, s.currency)}</span>}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === 'datetime' && service && (
        <>
          <DateTimeStep
            business={business}
            service={service}
            dateKey={dateKey}
            slot={slot}
            onPick={(k, s) => {
              setDateKey(k)
              setSlot(s)
            }}
          />
          <StepBar onBack={() => go(-1)} onNext={() => go(1)} disabled={!slot} />
        </>
      )}

      {step === 'details' && (
        <DetailsStep
          defaults={details}
          onNext={(v) => {
            setDetails(v)
            go(1)
          }}
          onBack={(v) => {
            setDetails(v)
            go(-1)
          }}
        />
      )}

      {step === 'refs' && (
        <ReferencesStep files={files} max={business.max_reference_images} onChange={setFiles} onBack={() => go(-1)} onNext={() => go(1)} />
      )}

      {step === 'review' && service && slot && dateKey && (
        <>
          <dl className="divide-y divide-line border-y border-line">
            <Row label="Servicio">
              <span className="font-medium">{service.name}</span>
              <span className="block text-sm text-muted">
                {formatDuration(service.duration_minutes)}
                {service.price_cents > 0 ? `, ${formatMoney(service.price_cents, service.currency)}` : ''}
              </span>
            </Row>
            <Row label="Cuándo">
              <span className="font-medium capitalize">{formatDayLong(dateKey)}</span>
              <span className="block text-sm text-muted">
                {formatTime(slot.slot_start, tz)} a {formatTime(slot.slot_end, tz)}
              </span>
            </Row>
            <Row label="A nombre de">
              <span className="font-medium">{details.name}</span>
              <span className="block break-all text-sm text-muted">{details.email}</span>
              <span className="block text-sm text-muted">{details.phone}</span>
            </Row>
            {details.notes && (
              <Row label="Indicaciones">
                <span className="whitespace-pre-line">{details.notes}</span>
              </Row>
            )}
            {files.length > 0 && <Row label="Fotos">{files.length === 1 ? '1 foto adjunta' : `${files.length} fotos adjuntas`}</Row>}
          </dl>

          {!business.auto_confirm && (
            <p className="mt-4 text-sm text-muted">Este negocio confirma cada reserva. Verás el estado en el enlace que te mostraremos.</p>
          )}

          {progress && (
            <p className="mt-4 text-sm" role="status">
              Subiendo foto {progress.current} de {progress.total}
            </p>
          )}

          <StepBar onBack={() => go(-1)} onNext={submit} nextLabel="Confirmar reserva" loading={submitting} />
        </>
      )}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[8rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

