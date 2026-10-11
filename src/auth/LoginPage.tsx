import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { humanError } from '@/lib/errors'
import { useAuth } from './AuthProvider'
import { AuthLayout } from './AuthLayout'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/States'

const schema = z.object({
  email: z.string().trim().email('Escribe un correo válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
})
type Values = z.infer<typeof schema>

export default function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/app'
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  if (session) return <Navigate to={from} replace />

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword(values)
    if (err) return setError(humanError(err))
    navigate(from, { replace: true })
  })

  return (
    <AuthLayout
      title="Entra a tu panel"
      subtitle="Gestiona tu agenda, tus servicios y tus reservas."
      footer={
        <>
          ¿Aún no tienes cuenta?{' '}
          <Link to="/registro" className="font-medium text-clay-strong underline underline-offset-4">
            Crear mi negocio
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Input label="Correo" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...register('email')} />
        <Input
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {error && <Notice>{error}</Notice>}
        <Button type="submit" full loading={isSubmitting}>
          Entrar
        </Button>
        <p className="text-center text-sm">
          <Link to="/recuperar" className="font-medium text-clay-strong underline underline-offset-4">
            Olvidé mi contraseña
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
