import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './Button'

/**
 * Diálogo accesible basado en <dialog> nativo (foco atrapado, Esc, fondo inerte).
 * Móvil: bottom sheet. Tableta y escritorio: panel lateral derecho.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children?: React.ReactNode
  footer?: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      aria-label={title}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-xl bg-surface p-0 text-ink backdrop:bg-ink/45 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:h-full md:w-[28rem] md:rounded-none md:border-l md:border-line"
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col md:h-full md:max-h-none">
          <div className="flex items-center justify-between gap-2 border-b border-line py-1 pl-5 pr-1">
            <h2 className="min-w-0 truncate font-display text-xl">{title}</h2>
            <IconButton label="Cerrar" onClick={onClose}>
              <X />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
          {footer && (
            <div className="border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
