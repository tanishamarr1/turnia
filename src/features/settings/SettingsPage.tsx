import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Copy, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { humanError } from '@/lib/errors'
import { copyText, publicUrl } from '@/lib/format'
import { uploadPublicAsset, validateImage } from '@/lib/storage'
import { Button, buttonClass } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Switch } from '@/components/ui/Switch'
import { Notice } from '@/components/ui/States'
import { useBusiness } from '../admin/BusinessContext'
import { timezoneOptions } from '../admin/timezones'

const schema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del negocio').max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Mínimo 3 caracteres')
    .max(48, 'Máximo 48 caracteres')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones'),
  description: z.string().trim().max(1000, 'Máximo 1000 caracteres').optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email('Correo no válido').or(z.literal('')).optional(),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  timezone: z.string().min(1),
  pending_hold_hours: z.number({ invalid_type_error: 'Escribe un número' }).int().min(1, 'Mínimo 1').max(168, 'Máximo 168'),
  max_reference_images: z.number({ invalid_type_error: 'Escribe un número' }).int().min(0, 'Mínimo 0').max(10, 'Máximo 10'),
})
type Values = z.infer<typeof schema>

export default function SettingsPage() {
  const { business, role, refresh } = useBusiness()
  const canEdit = role === 'owner' || role === 'admin'
  const [autoConfirm, setAutoConfirm] = useState(business.auto_confirm)
  const [published, setPublished] = useState(business.is_published)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: business.name,
      slug: business.slug,
      description: business.description ?? '',
      phone: business.phone ?? '',
      email: business.email ?? '',
      address: business.address ?? '',
      city: business.city ?? '',
      timezone: business.timezone,
      pending_hold_hours: business.pending_hold_hours,
      max_reference_images: business.max_reference_images,
    },
  })

  const slug = watch('slug')

  const onSubmit = handleSubmit(async (v) => {
    setMsg(null)
    const r = await supabase
      .from('businesses')
      .update({
        name: v.name,
        slug: v.slug,
        description: v.description || null,
        phone: v.phone || null,
        email: v.email || null,
        address: v.address || null,
        city: v.city || null,
        timezone: v.timezone,
        auto_confirm: autoConfirm,
        is_published: published,
        pending_hold_hours: v.pending_hold_hours,
        max_reference_images: v.max_reference_images,
      })
      .eq('id', business.id)
    if (r.error) return setMsg({ tone: 'error', text: humanError(r.error) })
    setMsg({ tone: 'ok', text: 'Cambios guardados.' })
    refresh()
  })

  return (
    <div className="max-w-2xl space-y-10">
      <header>
        <h1 className="font-display text-4xl">Ajustes del negocio</h1>
        {!canEdit && <p className="mt-2 text-muted">Solo propietarios y administradores pueden cambiar estos datos.</p>}
      </header>

      <section aria-labelledby="s-link">
        <h2 id="s-link" className="font-display text-2xl">
          Tu enlace para clientes
        </h2>
        <p className="mt-2 break-all rounded-md border border-line bg-paper px-3 py-3 font-mono text-sm">{publicUrl(slug || business.slug)}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={async () => {
              setCopied(await copyText(publicUrl(business.slug)))
              window.setTimeout(() => setCopied(false), 2000)
            }}
          >
            <Copy className="size-4" aria-hidden /> {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </Button>
          <a href={`/b/${business.slug}`} target="_blank" rel="noreferrer" className={buttonClass('secondary')}>
            <ExternalLink className="size-4" aria-hidden /> Ver mi página
          </a>
        </div>
      </section>

      <section aria-labelledby="s-images">
        <h2 id="s-images" className="font-display text-2xl">
          Logo y portada
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <ImageField label="Logo" folder="logo" field="logo_url" current={business.logo_url} disabled={!canEdit} square />
          <ImageField label="Portada" folder="cover" field="cover_url" current={business.cover_url} disabled={!canEdit} />
        </div>
      </section>

      <form onSubmit={onSubmit} noValidate className="space-y-10">
        <fieldset disabled={!canEdit} className="space-y-5">
          <legend className="font-display text-2xl">Perfil</legend>
          <Input label="Nombre del negocio" error={errors.name?.message} {...register('name')} />
          <Input label="Enlace público" hint="Si lo cambias, el enlace anterior dejará de funcionar." error={errors.slug?.message} {...register('slug')} />
          <Textarea label="Descripción" rows={4} error={errors.description?.message} {...register('description')} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Teléfono" type="tel" inputMode="tel" error={errors.phone?.message} {...register('phone')} />
            <Input label="Correo de contacto" type="email" inputMode="email" error={errors.email?.message} {...register('email')} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Dirección" error={errors.address?.message} {...register('address')} />
            <Input label="Ciudad" error={errors.city?.message} {...register('city')} />
          </div>
          <Select label="Zona horaria" hint="Define a qué hora se ofrecen tus citas." {...register('timezone')}>
            {timezoneOptions(business.timezone).map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </fieldset>

        <fieldset disabled={!canEdit} className="space-y-5">
          <legend className="font-display text-2xl">Reservas</legend>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">Confirmar reservas automáticamente</p>
              <p className="text-sm text-muted">Si lo desactivas, cada reserva queda pendiente hasta que la confirmes.</p>
            </div>
            <Switch label="Confirmar reservas automáticamente" checked={autoConfirm} onChange={setAutoConfirm} disabled={!canEdit} />
          </div>
          {!autoConfirm && (
            <Input
              label="Horas para confirmar una reserva pendiente"
              type="number"
              inputMode="numeric"
              hint="Pasado ese tiempo sin confirmar, la reserva expira y el horario se libera."
              error={errors.pending_hold_hours?.message}
              {...register('pending_hold_hours', { valueAsNumber: true })}
            />
          )}
          <Input
            label="Máximo de fotos de referencia por reserva"
            type="number"
            inputMode="numeric"
            hint="Pon 0 para no pedir fotos."
            error={errors.max_reference_images?.message}
            {...register('max_reference_images', { valueAsNumber: true })}
          />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">Página pública activa</p>
              <p className="text-sm text-muted">Si la desactivas, nadie podrá ver tu página ni reservar.</p>
            </div>
            <Switch label="Página pública activa" checked={published} onChange={setPublished} disabled={!canEdit} />
          </div>
        </fieldset>

        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        {canEdit && (
          <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto">
            Guardar cambios
          </Button>
        )}
      </form>
    </div>
  )
}

function ImageField({
  label,
  folder,
  field,
  current,
  disabled,
  square,
}: {
  label: string
  folder: string
  field: 'logo_url' | 'cover_url'
  current: string | null
  disabled?: boolean
  square?: boolean
}) {
  const { business, refresh } = useBusiness()
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFile(f: File) {
    const problem = validateImage(f, 10)
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    try {
      const url = await uploadPublicAsset(f, business.id, folder)
      const r = await supabase.from('businesses').update({ [field]: url }).eq('id', business.id)
      if (r.error) throw r.error
      await refresh()
    } catch (e) {
      setError(humanError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <div className={`mt-2 overflow-hidden rounded-md border border-line bg-clay-soft ${square ? 'size-28' : 'aspect-[16/7] w-full'}`}>
        {current && <img src={current} alt={`${label} actual`} className="size-full object-cover" />}
      </div>
      <Button variant="secondary" className="mt-2" onClick={() => ref.current?.click()} loading={busy} disabled={disabled}>
        {current ? 'Cambiar' : 'Subir'}
      </Button>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onFile(f)
        }}
      />
      {error && (
        <div className="mt-2">
          <Notice>{error}</Notice>
        </div>
      )}
    </div>
  )
}
