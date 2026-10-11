import type { HourRow } from '@/lib/types'

export type Interval = { start: string; end: string } // HH:MM
export type DaySchedule = { open: boolean; work: Interval[]; breaks: Interval[] }
export type Week = DaySchedule[] // índice 0 = lunes ... 6 = domingo

export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
/** La base de datos usa 0 = domingo ... 6 = sábado. */
export const dbWeekday = (uiIndex: number) => (uiIndex + 1) % 7

const hhmm = (t: string) => t.slice(0, 5)

export function rowsToWeek(rows: HourRow[]): Week {
  return DAY_NAMES.map((_, ui) => {
    const wd = dbWeekday(ui)
    const mine = rows.filter((r) => r.weekday === wd).sort((a, b) => a.start_time.localeCompare(b.start_time))
    const work = mine.filter((r) => r.kind === 'work').map((r) => ({ start: hhmm(r.start_time), end: hhmm(r.end_time) }))
    const breaks = mine.filter((r) => r.kind === 'break').map((r) => ({ start: hhmm(r.start_time), end: hhmm(r.end_time) }))
    return { open: work.length > 0, work, breaks }
  })
}

export function weekToRows(week: Week) {
  const out: { weekday: number; kind: 'work' | 'break'; start_time: string; end_time: string }[] = []
  week.forEach((day, ui) => {
    if (!day.open) return
    const weekday = dbWeekday(ui)
    day.work.forEach((i) => out.push({ weekday, kind: 'work', start_time: i.start, end_time: i.end }))
    day.breaks.forEach((i) => out.push({ weekday, kind: 'break', start_time: i.start, end_time: i.end }))
  })
  return out
}

/** Devuelve un mensaje si algún horario es inválido (fin antes del inicio, solapes, pausas fuera del turno). */
export function validateWeek(week: Week): string | null {
  for (let ui = 0; ui < week.length; ui++) {
    const day = week[ui]
    if (!day.open) continue
    const name = DAY_NAMES[ui]
    if (day.work.length === 0) return `${name}: añade al menos un turno o márcalo como cerrado.`
    for (const i of [...day.work, ...day.breaks]) {
      if (!i.start || !i.end) return `${name}: completa todas las horas.`
      if (i.end <= i.start) return `${name}: la hora final debe ser posterior a la inicial.`
    }
    const sorted = [...day.work].sort((a, b) => a.start.localeCompare(b.start))
    for (let k = 1; k < sorted.length; k++) {
      if (sorted[k].start < sorted[k - 1].end) return `${name}: hay turnos que se solapan.`
    }
  }
  return null
}
