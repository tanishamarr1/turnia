import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { humanError } from '@/lib/errors'
import { useAuth } from './AuthProvider'
import { AuthLayout } from './AuthLayout'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Loading, Notice } from '@/components/ui/States'

const schema = z
  .object({
    password: z.string().min(8, 'Usa al menos 8 caracteres'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden' })
type Values = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  // Al abrir el enlace del correo, Supabase crea una sesión temporal de recuperación.
  if (loading) return <Loading full />
  if (!session) {
    return (
      <AuthLayout title="Enlace no válido" footer={<Link to="/recuperar" className="font-medium text-clay-strong underline underline-offset-4">Pedir otro enlace</Link>}>
        <Notice tone="warn">El enlace venció o ya se usó. Solicita uno nuevo para cambiar tu contraseña.</Notice>
      </AuthLayout>
    )
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) return setError(humanError(err))
    navigate('/app', { replace: true })
  })

  return (
    <AuthLayout title="Nueva contraseña">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Input label="Contraseña nueva" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
        <Input label="Repite la contraseña" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        {error && <Notice>{error}</Notice>}
        <Button type="submit" full loading={isSubmitting}>
          Guardar contraseña
        </Button>
      </form>
    </AuthLayout>
  )
}
