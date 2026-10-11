const MESSAGES: [RegExp, string][] = [
  [/slot_unavailable/, 'Ese horario acaba de ocuparse. Elige otra hora.'],
  [/too_many_bookings/, 'Ya tienes varias reservas activas con este negocio. Cancela alguna o espera a que pasen.'],
  [/cannot_cancel/, 'Esta reserva ya no se puede cancelar.'],
  [/booking_not_found/, 'No encontramos esa reserva. Revisa el enlace.'],
  [/business_not_found|service_not_found/, 'Este servicio ya no está disponible.'],
  [/invalid_email/, 'El correo no es válido.'],
  [/invalid_phone/, 'El teléfono no es válido.'],
  [/invalid_name/, 'Escribe tu nombre completo.'],
  [/upload_window_closed/, 'Pasó demasiado tiempo para adjuntar fotos a esta reserva.'],
  [/too_many_references/, 'Alcanzaste el máximo de fotos para esta reserva.'],
  [/slug_taken|businesses_slug_key/, 'Ese enlace ya está en uso. Prueba con otro.'],
  [/businesses_slug_check/, 'El enlace debe tener 3 a 48 caracteres: minúsculas, números y guiones.'],
  [/invalid_timezone/, 'La zona horaria no es válida.'],
  [/Invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/Email not confirmed/i, 'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.'],
  [/User already registered/i, 'Ya existe una cuenta con ese correo.'],
  [/Password should be at least/i, 'La contraseña es demasiado corta.'],
  [/JWT expired|invalid JWT/i, 'Tu sesión expiró. Vuelve a iniciar sesión.'],
  [/row-level security|forbidden|permission denied/i, 'No tienes permiso para hacer esto.'],
  [/Failed to fetch|NetworkError|Load failed|network/i, 'Sin conexión. Revisa tu internet e inténtalo de nuevo.'],
  [/duplicate key|exclusion|conflicting key/i, 'Ese horario ya está ocupado.'],
]

export function errorText(e: unknown): string {
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return ''
}

export function humanError(e: unknown): string {
  const raw = errorText(e)
  for (const [re, msg] of MESSAGES) if (re.test(raw)) return msg
  return 'Algo salió mal. Inténtalo de nuevo en unos segundos.'
}

export const isSlotError = (e: unknown) => /slot_unavailable|exclusion/i.test(errorText(e))
