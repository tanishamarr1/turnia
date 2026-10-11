import { Button } from '@/components/ui/Button'

/** Barra de acciones del paso: pegada al borde inferior del flujo, respeta el área segura del teléfono. */
export function StepBar({
  onBack,
  nextLabel = 'Continuar',
  onNext,
  submit,
  disabled,
  loading,
  hideNext,
}: {
  onBack?: () => void
  nextLabel?: string
  onNext?: () => void
  submit?: boolean
  disabled?: boolean
  loading?: boolean
  hideNext?: boolean
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-line bg-ivory/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:px-0">
      <div className="flex gap-3">
        {onBack && (
          <Button variant="secondary" onClick={onBack} disabled={loading}>
            Atrás
          </Button>
        )}
        {!hideNext && (
          <Button
            type={submit ? 'submit' : 'button'}
            onClick={submit ? undefined : onNext}
            disabled={disabled}
            loading={loading}
            className="flex-1"
          >
            {nextLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
