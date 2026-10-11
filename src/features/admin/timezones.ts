const COMMON = [
  'America/Santo_Domingo', 'America/Puerto_Rico', 'America/Mexico_City', 'America/Bogota', 'America/Lima',
  'America/Caracas', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Sao_Paulo',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Panama',
  'America/Guatemala', 'America/Costa_Rica', 'America/Havana', 'Europe/Madrid', 'Europe/London', 'UTC',
]

/** Lista de zonas IANA: las del navegador si las expone, o una lista común. La actual siempre aparece. */
export function timezoneOptions(current: string): string[] {
  let all: string[] = COMMON
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    if (fn) all = fn('timeZone')
  } catch {
    /* usar lista común */
  }
  return Array.from(new Set([current, ...COMMON, ...all]))
}
