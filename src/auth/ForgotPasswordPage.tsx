import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { humanError } from '@/lib/errors'
import { AuthLayout } from './AuthLayout'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/States'

const schema = z.object({ email: z.string().trim().email('Escribe un correo válido') })
type Values = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer`,
    })
    if (err) return setError(humanError(err))
    setSent(true)
  })

  return (
    <AuthLayout
      title="Recupera tu contraseña"
      subtitle="Te enviaremos un enlace para crear una nueva."
      footer={<Link to="/acceso" className="font-medium text-clay-strong underline underline-offset-4">Volver a entrar</Link>}
    >
      {sent ? (
        <Notice tone="ok">Si ese correo tiene cuenta, recibirás el enlace en unos minutos.</Notice>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <Input label="Correo" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...register('email')} />
          {error && <Notice>{error}</Notice>}
          <Button type="submit" full loading={isSubmitting}>
            Enviar enlace
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
