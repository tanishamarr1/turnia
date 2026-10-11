import { useId } from 'react'

export const inputClass =
  'block min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-muted/70 transition-colors disabled:bg-paper disabled:text-muted aria-[invalid=true]:border-bad motion-reduce:transition-none'

type Shell = { label: string; hint?: string; error?: string }

function Wrap({ id, label, hint, error, children }: Shell & { id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="text-sm font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  )
}

const describe = (id: string, hint?: string, error?: string) =>
  error ? `${id}-err` : hint ? `${id}-hint` : undefined

export function Input({ label, hint, error, id, className = '', ...rest }: Shell & React.ComponentProps<'input'>) {
  const uid = useId()
  const fid = id ?? uid
  return (
    <Wrap id={fid} label={label} hint={hint} error={error}>
      <input
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(fid, hint, error)}
        className={`${inputClass} ${className}`}
        {...rest}
      />
    </Wrap>
  )
}

export function Textarea({ label, hint, error, id, className = '', ...rest }: Shell & React.ComponentProps<'textarea'>) {
  const uid = useId()
  const fid = id ?? uid
  return (
    <Wrap id={fid} label={label} hint={hint} error={error}>
      <textarea
        id={fid}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(fid, hint, error)}
        className={`${inputClass} resize-y ${className}`}
        {...rest}
      />
    </Wrap>
  )
}

export function Select({ label, hint, error, id, className = '', children, ...rest }: Shell & React.ComponentProps<'select'>) {
  const uid = useId()
  const fid = id ?? uid
  return (
    <Wrap id={fid} label={label} hint={hint} error={error}>
      <select
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(fid, hint, error)}
        className={`${inputClass} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </Wrap>
  )
}
