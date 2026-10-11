import { supabase } from './supabase'

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export function validateImage(file: File, maxMb = 5): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return `"${file.name}" no es una imagen compatible (JPG, PNG, WebP o HEIC).`
  if (file.size > maxMb * 1024 * 1024) return `"${file.name}" pesa más de ${maxMb} MB.`
  return null
}

const extFor = (type: string) => (type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : type.includes('hei') ? 'heic' : 'jpg')

/** Reduce el tamaño de fotos grandes antes de subirlas (ahorra datos móviles). Si falla, usa el original. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/') || file.type.includes('hei')) return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 1_500_000) {
      bitmap.close()
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

/** Sube una foto de referencia a la carpeta privada de la reserva y la registra en la base de datos. */
export async function uploadReference(args: {
  businessId: string
  appointmentId: string
  token: string
  file: File
}) {
  const { businessId, appointmentId, token, file } = args
  const path = `${businessId}/${appointmentId}/${crypto.randomUUID()}.${extFor(file.type)}`
  const up = await supabase.storage
    .from('appointment-references')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (up.error) throw up.error
  const reg = await supabase.rpc('add_appointment_reference', {
    p_token: token,
    p_path: path,
    p_file_name: file.name,
    p_mime: file.type,
    p_size: file.size,
  })
  if (reg.error) throw reg.error
}

/** Sube logo, portada o imagen de servicio al bucket público del negocio y devuelve su URL. */
export async function uploadPublicAsset(file: File, businessId: string, folder: string): Promise<string> {
  const prepared = await compressImage(file, 1800, 0.86)
  const path = `${businessId}/${folder}/${crypto.randomUUID()}.${extFor(prepared.type)}`
  const up = await supabase.storage
    .from('business-assets')
    .upload(path, prepared, { contentType: prepared.type, upsert: false, cacheControl: '31536000' })
  if (up.error) throw up.error
  return supabase.storage.from('business-assets').getPublicUrl(path).data.publicUrl
}
