import { Logo } from '@/components/ui/Logo'

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden border-r border-line bg-paper lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo />
        <div>
          <p className="max-w-md font-display text-5xl leading-[1.08]">Tus clientes eligen la hora. Tú atiendes.</p>
          <p className="mt-5 max-w-sm text-muted">
            Publica tus servicios, define tu horario y comparte un solo enlace para recibir reservas.
          </p>
        </div>
        <p className="text-sm text-muted">Cada negocio tiene sus datos separados y protegidos.</p>
      </aside>

      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] lg:justify-center">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="my-8 lg:my-0">
          <h1 className="font-display text-4xl leading-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
        {footer && <div className="mt-auto pt-6 text-center text-sm text-muted lg:mt-6">{footer}</div>}
      </main>
    </div>
  )
}
