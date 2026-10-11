import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ImagePlus, Pencil, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAsyncData } from '@/lib/hooks'
import { humanError } from '@/lib/errors'
import { formatDuration, formatMoney } from '@/lib/format'
import { uploadPublicAsset, validateImage } from '@/lib/storage'
import type { Service } from '@/lib/types'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Switch } from '@/components/ui/Switch'
import { EmptyState, ErrorState, Loading, Notice } from '@/components/ui/States'
import { Sheet } from '@/components/ui/Sheet'
import { useBusiness } from '../admin/BusinessContext'

export const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Escribe un nombre').max(80, 'Máximo 80 caracteres'),
  description: z.string().trim().max(600, 'Máximo 600 caracteres').optional(),
  price: z.number({ invalid_type_error: 'Escribe un precio (0 si es gratis)' }).min(0, 'No puede ser negativo').max(10_000_000),
  currency: z.string().length(3),
  duration: z.number({ invalid_type_error: 'Escribe la duración en minutos' }).int('Usa minutos enteros').min(5, 'Mínimo 5 minutos').max(720, 'Máximo 720 minutos'),
})
export type ServiceValues = z.infer<typeof serviceSchema>

export default function ServicesPage() {
  const { business } = useBusiness()
  const [editing, setEditing] = useState<Service | 'new' | null>(null)

  const { data, loading, error, reload } = useAsyncData(async () => {
    const r = await supabase.from('services').select('*').eq('business_id', business.id).order('sort_order').order('created_at')
    if (r.error) throw r.error
    return (r.data ?? []) as Service[]
  }, [business.id])

  async function toggle(s: Service, is_active: boolean) {
    const r = await supabase.from('services').update({ is_active }).eq('id', s.id)
    if (!r.error) reload()
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Servicios</h1>
          <p className="mt-2 text-muted">Lo que tus clientes pueden reservar. Los inactivos no aparecen en tu página.</p>
        </div>
        <Button onClick={() => setEditing('new')} className="shrink-0">
          <Plus className="size-4" aria-hidden /> Nuevo
        </Button>
      </header>

      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="Crea tu primer servicio"
          text="Sin servicios, tus clientes no tienen qué reservar."
          action={<Button onClick={() => setEditing('new')}>Crear servicio</Button>}
        />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {(data ?? []).map((s) => (
            <li key={s.id} className={`flex items-center gap-3 py-3 ${s.is_active ? '' : 'opacity-60'}`}>
              {s.image_url ? (
                <img src={s.image_url} alt="" loading="lazy" className="size-14 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="grid size-14 shrink-0 place-items-center rounded-md bg-clay-soft font-display text-xl text-clay-strong" aria-hidden>
                  {s.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl leading-snug">{s.name}</p>
                <p className="text-sm text-muted">
                  {formatDuration(s.duration_minutes)}
                  {s.price_cents > 0 ? `, ${formatMoney(s.price_cents, s.currency)}` : ', sin costo'}
                </p>
              </div>
              <Switch label={`${s.name}: ${s.is_active ? 'activo' : 'inactivo'}`} checked={s.is_active} onChange={(v) => toggle(s, v)} />
              <IconButton label={`Editar ${s.name}`} onClick={() => setEditing(s)}>
                <Pencil />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nuevo servicio' : 'Editar servicio'}>
        {editing !== null && (
          <ServiceForm
            key={editing === 'new' ? 'new' : editing.id}
            businessId={business.id}
            service={editing === 'new' ? null : editing}
            nextOrder={(data?.length ?? 0) + 1}
            onSaved={() => {
              setEditing(null)
              reload()
            }}
          />
        )}
      </Sheet>
    </div>
  )
}

function ServiceForm({
  businessId,
  service,
  nextOrder,
  onSaved,
}: {
  businessId: string
  service: Service | null
  nextOrder: number
  onSaved: () => void
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(service?.image_url ?? null)
  const [pending, setPending] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!pending) return setPreview(null)
    const u = URL.createObjectURL(pending)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [pending])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name ?? '',
      description: service?.description ?? '',
      price: service ? service.price_cents / 100 : 0,
      currency: service?.currency ?? 'DOP',
      duration: service?.duration_minutes ?? 30,
    },
  })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      let image = imageUrl
      if (pending) image = await uploadPublicAsset(pending, businessId, 'services')
      const row = {
        name: v.name,
        description: v.description || null,
        price_cents: Math.round(v.price * 100),
        currency: v.currency,
        duration_minutes: v.duration,
        image_url: image,
      }
      const r = service
        ? await supabase.from('services').update(row).eq('id', service.id)
        : await supabase.from('services').insert({ ...row, business_id: businessId, sort_order: nextOrder })
      if (r.error) throw r.error
      onSaved()
    } catch (e) {
      setError(humanError(e))
    }
  })

  const shown = preview ?? imageUrl

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Input label="Nombre" error={errors.name?.message} {...register('name')} />
      <Textarea label="Descripción (opcional)" error={errors.description?.message} {...register('description')} />
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
        <Input label="Precio" type="number" inputMode="decimal" step="0.01" min={0} error={errors.price?.message} {...register('price', { valueAsNumber: true })} />
        <Select label="Moneda" {...register('currency')}>
          <option value="DOP">DOP</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="MXN">MXN</option>
        </Select>
      </div>
      <Input label="Duración (minutos)" type="number" inputMode="numeric" min={5} step={5} error={errors.duration?.message} {...register('duration', { valueAsNumber: true })} />

      <div>
        <p className="text-sm font-medium">Imagen (opcional)</p>
        <div className="mt-2 flex items-center gap-4">
          {shown ? (
            <img src={shown} alt="Vista previa del servicio" className="size-20 rounded-md object-cover" />
          ) : (
            <span className="grid size-20 place-items-center rounded-md border border-dashed border-line-strong text-muted">
              <ImagePlus className="size-6" aria-hidden />
            </span>
          )}
          <div className="flex flex-col gap-2">
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              {shown ? 'Cambiar imagen' : 'Subir imagen'}
            </Button>
            {shown && (
              <Button variant="ghost" onClick={() => { setPending(null); setImageUrl(null) }}>
                Quitar
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              const problem = validateImage(f, 10)
              if (problem) return setError(problem)
              setError(null)
              setPending(f)
            }}
          />
        </div>
      </div>

      {error && <Notice>{error}</Notice>}
      <Button type="submit" full loading={isSubmitting}>
        {service ? 'Guardar cambios' : 'Crear servicio'}
      </Button>
    </form>
  )
}
