import { useMemo, useState } from 'react'
import { Mail, Phone, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAsyncData } from '@/lib/hooks'
import { formatInstant } from '@/lib/dates'
import type { Appointment } from '@/lib/types'
import { inputClass } from '@/components/ui/Field'
import { EmptyState, ErrorState, Loading } from '@/components/ui/States'
import { Sheet } from '@/components/ui/Sheet'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useBusiness } from '../admin/BusinessContext'
import { AppointmentSheet } from '../agenda/AppointmentSheet'

type Client = { key: string; name: string; email: string; phone: string; visits: Appointment[] }

/** Los clientes se derivan de las citas del negocio, agrupadas por correo. Nada se inventa. */
export default function ClientsPage() {
  const { business } = useBusiness()
  const tz = business.timezone
  const [q, setQ] = useState('')
  const [client, setClient] = useState<Client | null>(null)
  const [appt, setAppt] = useState<Appointment | null>(null)

  const { data, loading, error, reload } = useAsyncData(async () => {
    const r = await supabase
      .from('appointments')
      .select('*')
      .eq('business_id', business.id)
      .order('start_at', { ascending: false })
      .limit(1000)
    if (r.error) throw r.error
    return (r.data ?? []) as Appointment[]
  }, [business.id])

  const clients = useMemo(() => {
    const map = new Map<string, Client>()
    for (const a of data ?? []) {
      const key = a.customer_email.toLowerCase()
      const c = map.get(key) ?? { key, name: a.customer_name, email: a.customer_email, phone: a.customer_phone, visits: [] }
      c.visits.push(a)
      map.set(key, c)
    }
    return [...map.values()]
  }, [data])

  const shown = clients.filter((c) => {
    const t = q.trim().toLowerCase()
    return !t || c.name.toLowerCase().includes(t) || c.email.toLowerCase().includes(t) || c.phone.includes(t)
  })

  // Mantener sincronizado el cliente abierto cuando cambia una cita.
  const openClient = client ? clients.find((c) => c.key === client.key) ?? client : null

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-4xl">Clientes</h1>
        <p className="mt-2 text-muted">Personas que han reservado contigo, con su historial y sus fotos de referencia.</p>
      </header>

      <div className="relative">
        <label htmlFor="client-search" className="sr-only">
          Buscar cliente
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id="client-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, correo o teléfono"
          className={`${inputClass} pl-10`}
        />
      </div>

      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : clients.length === 0 ? (
        <EmptyState title="Aún no tienes clientes" text="Cuando alguien reserve en tu página, aparecerá aquí." />
      ) : shown.length === 0 ? (
        <EmptyState title="Sin resultados" text="Prueba con otro nombre, correo o teléfono." />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {shown.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => setClient(c)}
                className="flex min-h-16 w-full items-center justify-between gap-3 py-3 pl-1 pr-2 text-left hover:bg-paper"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block truncate text-sm text-muted">{c.email}</span>
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="block font-medium">{c.visits.length === 1 ? '1 cita' : `${c.visits.length} citas`}</span>
                  <span className="block text-muted">
                    {formatInstant(c.visits[0].start_at, tz, { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!openClient} onClose={() => setClient(null)} title={openClient?.name ?? 'Cliente'}>
        {openClient && (
          <div className="space-y-6">
            <div className="space-y-1">
              <a href={`tel:${openClient.phone}`} className="flex min-h-11 items-center gap-2.5 underline underline-offset-4">
                <Phone className="size-4 text-muted" aria-hidden /> {openClient.phone}
              </a>
              <a href={`mailto:${openClient.email}`} className="flex min-h-11 items-center gap-2.5 break-all underline underline-offset-4">
                <Mail className="size-4 shrink-0 text-muted" aria-hidden /> {openClient.email}
              </a>
            </div>
            <div>
              <h3 className="font-display text-xl">Historial</h3>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {openClient.visits.map((v) => (
                  <li key={v.id}>
                    <button type="button" onClick={() => setAppt(v)} className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left hover:bg-paper">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{v.service_name}</span>
                        <span className="block text-sm capitalize text-muted">
                          {formatInstant(v.start_at, tz, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </span>
                      <StatusBadge status={v.status} />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-muted">Abre una cita para ver sus fotos de referencia.</p>
            </div>
          </div>
        )}
      </Sheet>

      <AppointmentSheet
        appt={appt}
        tz={tz}
        onClose={() => setAppt(null)}
        onChanged={(a) => {
          setAppt(a)
          reload()
        }}
      />
    </div>
  )
}
