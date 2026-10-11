import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'
import { compressImage, validateImage } from '@/lib/storage'
import { Button, IconButton } from '@/components/ui/Button'
import { Notice, Spinner } from '@/components/ui/States'
import { StepBar } from './StepBar'

export function ReferencesStep({
  files,
  max,
  onChange,
  onBack,
  onNext,
}: {
  files: File[]
  max: number
  onChange: (files: File[]) => void
  onBack: () => void
  onNext: () => void
}) {
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  async function add(list: FileList | null) {
    if (!list || list.length === 0) return
    setError(null)
    const incoming = Array.from(list)
    const room = max - files.length
    const problems: string[] = []
    const valid = incoming.filter((f) => {
      const p = validateImage(f)
      if (p) problems.push(p)
      return !p
    })
    if (valid.length > room) problems.push(`Puedes adjuntar hasta ${max} fotos.`)
    setProcessing(true)
    const processed = await Promise.all(valid.slice(0, Math.max(room, 0)).map((f) => compressImage(f)))
    setProcessing(false)
    onChange([...files, ...processed])
    if (problems.length) setError(problems.join(' '))
  }

  const full = files.length >= max

  return (
    <div className="space-y-5">
      <p className="text-muted">
        Si tienes una foto de referencia, súbela para que el negocio se prepare. Es opcional. Máximo {max}, hasta 5 MB cada una.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => galleryRef.current?.click()} disabled={full || processing}>
          <ImagePlus className="size-5" aria-hidden /> Elegir de la galería
        </Button>
        <Button variant="secondary" onClick={() => cameraRef.current?.click()} disabled={full || processing}>
          <Camera className="size-5" aria-hidden /> Tomar foto
        </Button>
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          hidden
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {processing && (
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <Spinner className="size-4" /> Preparando fotos
        </p>
      )}
      {error && <Notice tone="warn">{error}</Notice>}

      {files.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="relative aspect-square overflow-hidden rounded-md border border-line bg-paper">
              <img src={previews[i]} alt={`Referencia ${i + 1}: ${f.name}`} className="size-full object-cover" />
              <IconButton
                label={`Quitar ${f.name}`}
                className="absolute right-1 top-1 bg-ink/70 text-white hover:bg-ink"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                <X />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <StepBar onBack={onBack} onNext={onNext} nextLabel={files.length ? 'Continuar' : 'Omitir'} disabled={processing} />
    </div>
  )
}
