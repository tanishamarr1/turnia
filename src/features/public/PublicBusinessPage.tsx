import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Mail, MapPin, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAsyncData } from '@/lib/hooks'
import { formatClock } from '@/lib/dates'
import type { HourRow, PublicBusiness, Service } from '@/lib/types'
import { EmptyState, ErrorState, Loading } from '@/components/ui/States'
import { Logo } from '@/components/ui/Logo'
import { BookingFlow } from './BookingFlow'

const PUBLIC_COLUMNS =
  'id,slug,name,description,logo_url,cover_url,phone,email,address,city,timezone,max_advance_days,max_reference_images,auto_confirm'
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default function PublicBusinessPage() {
  const { slug = '' } = useParams()

  const { data, loading, error, reload } = useAsyncData(async () => {
    const b = await supabase.from('businesses').select(PUBLIC_COLUMNS).eq('slug', slug).maybeSingle()
    if (b.error) throw b.error
    if (!b.data) return null
    const business = b.data as PublicBusiness
    const [s, h] = await Promise.all([
      supabase.from('services').select('*').eq('business_id', business.id).eq('is_active', true).order('sort_order').order('name'),
      supabase.from('business_hours').select('weekday,kind,start_time,end_time').eq('business_id', business.id).eq('kind', 'work'),
    ])
    if (s.error) throw s.error
    if (h.error) throw h.error
    return { business, services: (s.data ?? []) as Service[], hours: (h.data ?? []) as HourRow[] }
  }, [slug])

  useEffect(() => {
    if (data?.business) document.title = `${data.business.name} | Reservas`
    return () => {
      document.title = 'Turnia'
    }
  }, [data?.business])

  if (loading && !data) return <Loading full />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-5">
        <EmptyState
          title="No encontramos este negocio"
          text="Revisa que el enlace esté completo o pídele uno nuevo al negocio."
          action={<Logo />}
        />
      </main>
    )
  }

  const { business, services, hours } = data
  const place = [business.address, business.city].filter(Boolean).join(', ')

  return (
    <div className="min-h-dvh">
      <div className="relative aspect-[16/8] max-h-80 w-full overflow-hidden bg-clay-soft sm:aspect-[21/8]">
        {business.cover_url && <img src={business.cover_url} alt="" className="size-full object-cover" />}
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 lg:px-8">
        <header className="-mt-9 lg:sticky lg:top-8 lg:self-start">
          <div className="grid size-[4.5rem] place-items-center overflow-hidden rounded-md border border-line bg-surface">
            {business.logo_url ? (
              <img src={business.logo_url} alt={`Logo de ${business.name}`} className="size-full object-cover" />
            ) : (
              <span className="font-display text-3xl text-clay-strong" aria-hidden>
                {business.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <h1 className="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl">{business.name}</h1>
          {business.description && <p className="mt-3 max-w-prose whitespace-pre-line text-muted">{business.description}</p>}

          <ul className="mt-5 space-y-2 text-sm">
            {place && (
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                <span>{place}</span>
              </li>
            )}
            {business.phone && (
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-muted" aria-hidden />
                <a href={`tel:${business.phone}`} className="underline underline-offset-4">
                  {business.phone}
                </a>
              </li>
            )}
            {business.email && (
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0 text-muted" aria-hidden />
                <a href={`mailto:${business.email}`} className="break-all underline underline-offset-4">
                  {business.email}
                </a>
              </li>
            )}
          </ul>

          <details className="mt-6 border-t border-line pt-3">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">Horario de atención</summary>
            <dl className="mt-1 space-y-1.5 pb-2 text-sm">
              {DAY_NAMES.map((name, ui) => {
                const wd = (ui + 1) % 7
                const rows = hours.filter((h) => h.weekday === wd).sort((a, b) => a.start_time.localeCompare(b.start_time))
                return (
                  <div key={name} className="flex justify-between gap-4">
                    <dt className="text-muted">{name}</dt>
                    <dd className="text-right">
                      {rows.length === 0
                        ? 'Cerrado'
                        : rows.map((r) => `${formatClock(r.start_time)} a ${formatClock(r.end_time)}`).join(' y ')}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </details>
        </header>

        <div className="mt-10 lg:mt-12">
          {services.length === 0 ? (
            <EmptyState title="Aún no hay servicios disponibles" text="Este negocio todavía no publicó servicios para reservar." />
          ) : (
            <BookingFlow business={business} services={services} />
          )}
        </div>
      </main>

      <footer className="border-t border-line px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-sm text-muted">
        Reservas con{' '}
        <Link to="/" className="font-medium text-ink underline underline-offset-4">
          Turnia
        </Link>
      </footer>
    </div>
  )
}
