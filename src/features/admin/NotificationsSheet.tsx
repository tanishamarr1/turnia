import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { formatInstant } from '@/lib/dates'
import type { AppNotification } from '@/lib/types'
import { IconButton } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState } from '@/components/ui/States'

export function NotificationsButton({ tz }: { tz: string }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])

  const load = useCallback(async () => {
    if (!user) return
    const r = await supabase
      .from('notifications')
      .select('id,type,title,body,appointment_id,read_at,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    if (!r.error) setItems((r.data ?? []) as AppNotification[])
  }, [user])

  useEffect(() => {
    load()
    const t = window.setInterval(load, 60_000)
    return () => window.clearInterval(t)
  }, [load])

  const unread = items.filter((n) => !n.read_at).length

  async function onOpen() {
    setOpen(true)
    await load()
  }

  async function onClose() {
    setOpen(false)
    if (!user || unread === 0) return
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null)
    load()
  }

  return (
    <>
      <div className="relative">
        <IconButton label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'} onClick={onOpen}>
          <Bell />
        </IconButton>
        {unread > 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-1 top-1 grid min-w-4.5 place-items-center rounded-full bg-clay-strong px-1 text-[10px] font-semibold leading-4.5 text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </div>

      <Sheet open={open} onClose={onClose} title="Notificaciones">
        {items.length === 0 ? (
          <EmptyState title="Todo al día" text="Aquí aparecerán las nuevas reservas y cancelaciones." />
        ) : (
          <ul className="-my-2 divide-y divide-line">
            {items.map((n) => (
              <li key={n.id} className="py-3">
                <p className={`flex items-center gap-2 ${n.read_at ? '' : 'font-semibold'}`}>
                  {!n.read_at && <span className="size-2 shrink-0 rounded-full bg-clay-strong" aria-label="Sin leer" />}
                  {n.title}
                </p>
                {n.body && <p className="text-sm text-muted">{n.body}</p>}
                <p className="mt-0.5 text-xs text-muted">
                  {formatInstant(n.created_at, tz, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  )
}
