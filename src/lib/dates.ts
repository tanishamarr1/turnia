/*
  Utilidades de fechas con zona horaria.
  - Los instantes llegan de la base de datos como ISO (UTC) y se muestran en la zona del negocio.
  - Una "clave de fecha" es un texto YYYY-MM-DD que representa un día del calendario (sin zona).
*/
export const LOCALE = 'es-DO'
export const DEFAULT_TZ = 'America/Santo_Domingo'

export function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(utcMs / 1000) * 1000
}

/** Convierte "día + hora local del negocio" en el instante UTC correspondiente. */
export function zonedToUtc(dateKey: string, time: string, tz: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const first = guess - tzOffsetMs(guess, tz)
  return new Date(guess - tzOffsetMs(first, tz))
}

const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const toKey = (dt: Date) => dt.toISOString().slice(0, 10)

export const dateKeyInTz = (d: Date | string, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    typeof d === 'string' ? new Date(d) : d,
  )

export const todayKey = (tz: string) => dateKeyInTz(new Date(), tz)

export function addDays(key: string, n: number): string {
  const dt = parseKey(key)
  dt.setUTCDate(dt.getUTCDate() + n)
  return toKey(dt)
}
export const monthStart = (key: string) => key.slice(0, 7) + '-01'
/** Primer día del mes desplazado n meses. */
export function addMonths(key: string, n: number): string {
  const dt = parseKey(monthStart(key))
  dt.setUTCMonth(dt.getUTCMonth() + n)
  return toKey(dt)
}
export const monthEnd = (key: string) => addDays(addMonths(key, 1), -1)
export const weekdayOf = (key: string) => parseKey(key).getUTCDay() // 0 = domingo
export const startOfWeek = (key: string) => addDays(key, -((weekdayOf(key) + 6) % 7)) // lunes

/** Celdas de un mes con semana iniciando en lunes: null = hueco antes del día 1. */
export function monthCells(key: string): (string | null)[] {
  const first = monthStart(key)
  const lead = (weekdayOf(first) + 6) % 7
  const total = parseKey(monthEnd(key)).getUTCDate()
  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= total; d++) cells.push(first.slice(0, 8) + String(d).padStart(2, '0'))
  return cells
}

export function dayRangeUtc(key: string, tz: string) {
  return {
    from: zonedToUtc(key, '00:00', tz).toISOString(),
    to: zonedToUtc(addDays(key, 1), '00:00', tz).toISOString(),
  }
}

const fmt = (opts: Intl.DateTimeFormatOptions, value: Date | string, tz: string) =>
  new Intl.DateTimeFormat(LOCALE, { timeZone: tz, ...opts }).format(typeof value === 'string' ? new Date(value) : value)

export const formatTime = (iso: string, tz: string) => fmt({ hour: 'numeric', minute: '2-digit', hour12: true }, iso, tz)

export function timeParts(iso: string, tz: string) {
  const p = new Intl.DateTimeFormat(LOCALE, { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(
    new Date(iso),
  )
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return { clock: `${get('hour')}:${get('minute')}`, period: get('dayPeriod') }
}

/** Formatea una clave de fecha (YYYY-MM-DD). */
export const formatKey = (key: string, opts: Intl.DateTimeFormatOptions) => fmt(opts, parseKey(key), 'UTC')
export const formatInstant = (iso: string, tz: string, opts: Intl.DateTimeFormatOptions) => fmt(opts, iso, tz)

export const formatDayLong = (key: string) => formatKey(key, { weekday: 'long', day: 'numeric', month: 'long' })

/** "09:00:00" -> "9:00 a. m." para mostrar horarios de la semana. */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return fmt({ hour: 'numeric', minute: '2-digit', hour12: true }, new Date(Date.UTC(2000, 0, 1, h, m)), 'UTC')
}

export function minutesSince(dayStartIso: string, iso: string) {
  return (new Date(iso).getTime() - new Date(dayStartIso).getTime()) / 60000
}
