import { Link } from 'react-router-dom'

export function Logo({ to = '/', className = '' }: { to?: string; className?: string }) {
  return (
    <Link to={to} aria-label="Turnia, inicio" className={`inline-flex items-baseline font-display text-2xl font-medium tracking-tight ${className}`}>
      Turnia
      <span className="ml-0.5 inline-block size-1.5 bg-clay" aria-hidden />
    </Link>
  )
}
