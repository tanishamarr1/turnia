import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, Copy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { humanError } from '@/lib/errors'
import { copyText, publicUrl, slugify } from '@/lib/format'
import { Logo } from '@/components/ui/Logo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Loading, Notice } from '@/components/ui/States'
import { useBusinessContext } from './BusinessContext'
import { timezoneOptions } from './timezones'
import { HoursEditor } from '../availability/HoursEditor'
import { rowsToWeek, validateWeek, weekToRows, type Week } from '../availability/hours'
import type { HourRow } from '@/lib/types'

const STEPS = ['Tu negocio', 'Primer servicio', 'Horarios', 'Listo']

export default function OnboardingPage() {
  const { business, loading, refresh } = useBusinessContext()
  const [step, setStep] = useState(0)

  // Si ya existe el negocio (incorporación a medias), continuar desde el segundo paso.
  useEffect(() => {
    if (!loading) setStep((s) => (business && s === 0 ? 1 : s))
  }, [loading, business])

  if (loading) return <Loading full />
  if (business?.onboarding_completed && step < 3) return <Navigate to="/app" replace />

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Logo to="/app/bienvenida" />

      <ol className="mt-8 flex gap-1.5" aria-label="Progreso">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1" aria-current={i === step ? 'step' : undefined}>
            <span className={`block h-1 rounded-full ${i <= step ? 'bg-clay-strong' : 'bg-line'}`} />
            <span className={`mt-1.5 block text-xs ${i === step ? 'font-semibold' : 'text-muted'}`}>{s}</span>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        {step === 0 && <BusinessStep onDone={async () => { await refresh(); setStep(1) }} />}
        {step === 1 && business && <ServiceStep businessId={business.id} onDone={() => setStep(2)} />}
        {step === 2 && business && (
          <HoursStep
            businessId={business.id}
            onDone={async () => {
              const r = await supabase.from('businesses').update({ onboarding_completed: true }).eq('id', business.id)
              if (r.error) throw r.error
              await refresh()
              setStep(3)
            }}
          />
        )}
        {step === 3 && business && <DoneStep slug={business.slug} />}
      </div>
    </div>
  )
}

const businessSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre de tu negocio').max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Mínimo 3 caracteres')
    .max(48, 'Máximo 48 caracteres')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones'),
  timezone: z.string().min(1),
})
type BusinessValues = z.infer<typeof businessSchema>

function BusinessStep({ onDone }: { onDone: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BusinessValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: { name: '', slug: '', timezone: browserTz || 'America/Santo_Domingo' },
  })

  const nameField = register('name')
  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    const r = await supabase.rpc('create_business', { p_name: v.name, p_slug: v.slug, p_timezone: v.timezone })
    if (r.error) return setError(humanError(r.error))
    await onDone()
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <h1 className="font-display text-4xl">Cuéntanos de tu negocio</h1>
      <Input
        label="Nombre del negocio"
        autoComplete="organization"
        error={errors.name?.message}
        {...nameField}
        onChange={(e) => {
          nameField.onChange(e)
          if (!slugTouched) setValue('slug', slugify(e.target.value), { shouldValidate: false })
        }}
      />
      <Input
        label="Enlace público"
        hint="Tus clientes entrarán desde /b/ seguido de este texto."
        error={errors.slug?.message}
        {...register('slug', { onChange: () => setSlugTouched(true) })}
      />
      <Select label="Zona horaria" hint="Tus horarios se calculan con esta zona." {...register('timezone')}>
        {timezoneOptions(browserTz).map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, ' ')}
          </option>
        ))}
      </Select>
      {error && <Notice>{error}</Notice>}
      <Button type="submit" full loading={isSubmitting}>
        Continuar
      </Button>
    </form>
  )
}

const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Escribe un nombre').max(80),
  price: z.number({ invalid_type_error: 'Escribe un precio (0 si es gratis)' }).min(0, 'No puede ser negativo'),
  duration: z.number({ invalid_type_error: 'Escribe la duración' }).int().min(5, 'Mínimo 5 minutos').max(720, 'Máximo 720 minutos'),
})
type ServiceValues = z.infer<typeof serviceSchema>

function ServiceStep({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ServiceValues>({ resolver: zodResolver(serviceSchema), defaultValues: { name: '', price: 0, duration: 30 } })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    const r = await supabase.from('services').insert({
      business_id: businessId,
      name: v.name,
      price_cents: Math.round(v.price * 100),
      duration_minutes: v.duration,
      sort_order: 1,
    })
    if (r.error) return setError(humanError(r.error))
    onDone()
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <h1 className="font-display text-4xl">Añade tu primer servicio</h1>
      <p className="text-muted">Después podrás agregar más y editar descripción e imagen.</p>
      <Input label="Nombre del servicio" error={errors.name?.message} {...register('name')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Precio (DOP)" type="number" inputMode="decimal" step="0.01" min={0} error={errors.price?.message} {...register('price', { valueAsNumber: true })} />
        <Input label="Duración (min)" type="number" inputMode="numeric" step={5} min={5} error={errors.duration?.message} {...register('duration', { valueAsNumber: true })} />
      </div>
      {error && <Notice>{error}</Notice>}
      <Button type="submit" full loading={isSubmitting}>
        Continuar
      </Button>
    </form>
  )
}

function HoursStep({ businessId, onDone }: { businessId: string; onDone: () => Promise<void> }) {
  const [week, setWeek] = useState<Week | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase
      .from('business_hours')
      .select('weekday,kind,start_time,end_time')
      .eq('business_id', businessId)
      .then((r) => {
        if (r.error) setError(humanError(r.error))
        else setWeek(rowsToWeek((r.data ?? []) as HourRow[]))
      })
  }, [businessId])

  async function save() {
    if (!week) return
    const problem = validateWeek(week)
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    try {
      const r = await supabase.rpc('replace_business_hours', { p_business_id: businessId, p_hours: weekToRows(week) })
      if (r.error) throw r.error
      await onDone()
    } catch (e) {
      setError(humanError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-4xl">¿Cuándo atiendes?</h1>
      <p className="text-muted">Ajusta tus días y horas. Los días cerrados no mostrarán horarios.</p>
      {week ? <HoursEditor value={week} onChange={setWeek} /> : <Loading />}
      {error && <Notice>{error}</Notice>}
      <Button full onClick={save} loading={busy} disabled={!week}>
        Terminar configuración
      </Button>
    </div>
  )
}

function DoneStep({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-5">
      <span className="grid size-12 place-items-center rounded-full bg-ok-soft text-ok">
        <Check className="size-6" aria-hidden />
      </span>
      <h1 className="font-display text-4xl">Tu página está lista</h1>
      <p className="text-muted">Comparte este enlace con tus clientes para que reserven.</p>
      <p className="break-all rounded-md border border-line bg-surface px-3 py-3 font-mono text-sm">{publicUrl(slug)}</p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={async () => {
            setCopied(await copyText(publicUrl(slug)))
            window.setTimeout(() => setCopied(false), 2000)
          }}
        >
          <Copy className="size-4" aria-hidden /> {copied ? 'Enlace copiado' : 'Copiar enlace'}
        </Button>
        <ButtonLink to={`/b/${slug}`} variant="secondary" target="_blank">
          Ver mi página
        </ButtonLink>
      </div>
      <Button full onClick={() => navigate('/app', { replace: true })}>
        Ir a mi panel
      </Button>
    </div>
  )
}
