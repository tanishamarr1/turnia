import { Link, type LinkProps } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const base =
  'inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-md px-4 text-[15px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0'

const variants: Record<Variant, string> = {
  primary: 'bg-clay-strong text-white hover:bg-clay-deep',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-paper',
  ghost: 'text-ink hover:bg-ink/5',
  danger: 'border border-bad/40 bg-surface text-bad hover:bg-bad-soft',
}

export const buttonClass = (variant: Variant = 'primary', full = false, extra = '') =>
  [base, variants[variant], full ? 'w-full' : '', extra].filter(Boolean).join(' ')

type ButtonProps = React.ComponentProps<'button'> & { variant?: Variant; loading?: boolean; full?: boolean }

export function Button({ variant = 'primary', loading, full, className = '', children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, full, className)}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
      {children}
    </button>
  )
}

export function ButtonLink({
  variant = 'primary',
  full,
  className = '',
  ...rest
}: LinkProps & { variant?: Variant; full?: boolean }) {
  return <Link className={buttonClass(variant, full, className)} {...rest} />
}

/** Botón solo icono con área táctil de 44 px. */
export function IconButton({
  label,
  className = '',
  children,
  type = 'button',
  ...rest
}: React.ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none [&>svg]:size-5 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
