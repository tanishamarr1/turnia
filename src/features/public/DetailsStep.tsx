import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input, Textarea } from '@/components/ui/Field'
import { StepBar } from './StepBar'

export const detailsSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre completo').max(120, 'Es demasiado largo'),
  email: z.string().trim().email('Escribe un correo válido'),
  phone: z
    .string()
    .trim()
    .min(7, 'Escribe un teléfono válido')
    .max(25, 'Escribe un teléfono válido')
    .regex(/^[0-9+()\-\s]+$/, 'Usa solo números, espacios y + ( ) -'),
  notes: z.string().trim().max(500, 'Máximo 500 caracteres').optional(),
})
export type Details = z.infer<typeof detailsSchema>

export function DetailsStep({
  defaults,
  onNext,
  onBack,
}: {
  defaults: Details
  onNext: (v: Details) => void
  onBack: (v: Details) => void
}) {
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<Details>({ resolver: zodResolver(detailsSchema), defaultValues: defaults })

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate className="space-y-5">
      <Input label="Nombre completo" autoComplete="name" error={errors.name?.message} {...register('name')} />
      <Input
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        inputMode="email"
        hint="Aquí te enviaremos el enlace de tu reserva."
        error={errors.email?.message}
        {...register('email')}
      />
      <Input label="Teléfono" type="tel" autoComplete="tel" inputMode="tel" error={errors.phone?.message} {...register('phone')} />
      <Textarea
        label="Indicaciones para la cita (opcional)"
        hint="Cuéntale al negocio lo que necesita saber."
        error={errors.notes?.message}
        {...register('notes')}
      />
      <StepBar submit onBack={() => onBack(getValues())} />
    </form>
  )
}
