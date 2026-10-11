import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MailCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { humanError } from '@/lib/errors'
import { useAuth } from './AuthProvider'
import { AuthLayout } from './AuthLayout'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/States'

const schema = z.object({
  fullName: z.string().trim().min(2, 'Escribe tu nombre'),
  email: z.string().trim().email('Escribe un correo válido'),
  password: z.string().min(8, 'Usa al menos 8 caracteres'),
})
type Values = z.infer<typeof schema>

export default function RegisterPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  if (session && !sentTo) return <Navigate to="/app" replace />

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    const { data, error: err } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: { data: { full_name: v.fullName }, emailRedirectTo: `${window.location.origin}/acceso` },
    })
    if (err) return setError(humanError(err))
    // Con confirmación de correo activa no hay sesión hasta que la persona confirma.
    if (data.session) navigate('/app', { replace: true })
    else setSentTo(v.email)
  })

  if (sentTo) {
    return (
      <AuthLayout title="Revisa tu correo" footer={<Link to="/acceso" className="font-medium text-clay-strong underline underline-offset-4">Ir a entrar</Link>}>
        <div className="flex gap-3 rounded-md border border-line bg-surface p-4">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
          <p className="text-sm">
            Enviamos un enlace de confirmación a <strong className="break-all">{sentTo}</strong>. Ábrelo para activar tu cuenta y
            después entra para crear tu negocio.
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Después configuras tu negocio en tres pasos cortos."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/acceso" className="font-medium text-clay-strong underline underline-offset-4">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Input label="Tu nombre" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
        <Input label="Correo" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...register('email')} />
        <Input
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          hint="Mínimo 8 caracteres."
          error={errors.password?.message}
          {...register('password')}
        />
        {error && <Notice>{error}</Notice>}
        <Button type="submit" full loading={isSubmitting}>
          Crear cuenta
        </Button>
      </form>
    </AuthLayout>
  )
}
