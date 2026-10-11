import { Link } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'

const STEPS = [
  { title: 'Publica tus servicios', text: 'Nombre, duración, precio y una imagen si quieres.' },
  { title: 'Define cuándo atiendes', text: 'Horario por día, pausas, vacaciones y tiempo entre citas.' },
  { title: 'Comparte tu enlace', text: 'Tus clientes eligen hora desde el teléfono, sin crear cuenta.' },
]

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))] md:px-8">
        <Logo />
        <nav aria-label="Cuenta" className="flex items-center gap-1">
          <Link to="/acceso" className="inline-flex min-h-11 items-center rounded-md px-3 text-[15px] font-medium hover:bg-ink/5">
            Entrar
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 md:px-8 md:pt-16 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <div>
          <h1 className="font-display text-5xl leading-[1.04] md:text-7xl">Las citas de tu negocio caben en un enlace.</h1>
          <p className="mt-6 max-w-lg text-lg text-muted">
            Turnia le da a cada negocio su página de reservas y un panel privado para llevar la agenda, pensado primero para el teléfono.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/registro">Crear mi negocio</ButtonLink>
            <ButtonLink to="/acceso" variant="secondary">
              Ya tengo cuenta
            </ButtonLink>
          </div>
        </div>

        <ol className="mt-14 divide-y divide-line border-y border-line lg:mt-3 lg:self-end">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[2.5rem_1fr] gap-3 py-5">
              <span className="font-display text-3xl leading-none text-clay-strong" aria-hidden>
                {i + 1}
              </span>
              <div>
                <h2 className="font-display text-2xl">{s.title}</h2>
                <p className="mt-1 text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </main>
    </div>
  )
}
