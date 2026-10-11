import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from './Button'

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`size-5 animate-spin motion-reduce:animate-none ${className}`} aria-hidden />
}

export function Loading({ full, label = 'Cargando' }: { full?: boolean; label?: string }) {
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-3 text-muted ${full ? 'min-h-dvh' : 'min-h-40'}`}
    >
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string
  text?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-sm py-12 text-center">
      <h3 className="font-display text-2xl">{title}</h3>
      {text && <p className="mt-2 text-muted">{text}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-sm py-12 text-center">
      <AlertCircle className="mx-auto size-7 text-bad" aria-hidden />
      <h3 className="mt-3 font-display text-2xl">No pudimos cargar esto</h3>
      <p className="mt-2 text-muted">{message}</p>
      {onRetry && (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      )}
    </div>
  )
}

export function Notice({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'warn' | 'ok'
  children: React.ReactNode
}) {
  const styles = {
    error: 'border-bad/30 bg-bad-soft text-bad',
    warn: 'border-warn/30 bg-warn-soft text-warn',
    ok: 'border-ok/30 bg-ok-soft text-ok',
  }[tone]
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2.5 text-sm font-medium ${styles}`}>
      {children}
    </p>
  )
}
