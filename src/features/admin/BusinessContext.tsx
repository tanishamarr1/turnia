import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { humanError } from '@/lib/errors'
import { useAuth } from '@/auth/AuthProvider'
import type { Business, Role } from '@/lib/types'

type Ctx = {
  loading: boolean
  error?: string
  business: Business | null
  role: Role | null
  refresh: () => Promise<void>
}

const BusinessContext = createContext<Ctx | null>(null)
const STORAGE_KEY = 'turnia:business'

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<Omit<Ctx, 'refresh'>>({ loading: true, business: null, role: null })

  const load = useCallback(async () => {
    if (!user) return
    const r = await supabase
      .from('business_members')
      .select('role, business:businesses(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (r.error) {
      setState({ loading: false, business: null, role: null, error: humanError(r.error) })
      return
    }
    const rows = (r.data ?? []) as unknown as { role: Role; business: Business }[]
    const saved = localStorage.getItem(STORAGE_KEY)
    const pick = rows.find((x) => x.business?.id === saved) ?? rows[0]
    if (pick?.business) localStorage.setItem(STORAGE_KEY, pick.business.id)
    setState({ loading: false, business: pick?.business ?? null, role: pick?.role ?? null })
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const value = useMemo<Ctx>(() => ({ ...state, refresh: load }), [state, load])
  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
}

export function useBusinessContext() {
  const ctx = useContext(BusinessContext)
  if (!ctx) throw new Error('useBusinessContext debe usarse dentro de BusinessProvider')
  return ctx
}

/** Para las pantallas del panel: el negocio siempre existe (lo garantiza RequireBusiness). */
export function useBusiness() {
  const { business, role, refresh } = useBusinessContext()
  if (!business) throw new Error('No hay negocio activo')
  return { business, role, refresh }
}
