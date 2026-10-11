# Turnia

Plataforma de reservas para negocios y profesionales independientes. React + Vite + TypeScript + Tailwind CSS v4 + Supabase (Auth, PostgreSQL, Storage, RLS). Diseño mobile-first.

## 1. Poner en marcha

```bash
npm install
cp .env.example .env.local     # y completa las dos variables
npm run typecheck              # verifica los tipos
npm run dev
```

Variables (`.env.local`):

| Variable | Dónde obtenerla |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Misma pantalla, clave pública (anon o publishable). **Nunca** la `service_role`. |

## 2. Configurar Supabase

1. Crea un proyecto en supabase.com.
2. Aplica las migraciones de `supabase/migrations/` en orden. Opción A: pegar cada archivo en **SQL Editor** y ejecutarlo. Opción B: con la CLI (`supabase link --project-ref TU_REF` y `supabase db push`).
   - `..0100_schema.sql`: tablas, índices, restricciones, triggers y la restricción anti solapamiento.
   - `..0200_rls_storage.sql`: funciones de permisos, políticas RLS y buckets de Storage.
   - `..0300_booking_functions.sql`: disponibilidad, reservas, cancelación con token y alta de negocio.
3. **Authentication → URL Configuration**: Site URL = la URL de tu app; añade a Redirect URLs `http://localhost:5173/**` y la URL de producción (se usan en confirmación de correo y recuperación de contraseña).
4. **Authentication → Providers → Email**: deja activa la confirmación de correo si quieres (la app ya la maneja).
5. Verifica en **Storage** que existan los buckets `business-assets` (público) y `appointment-references` (privado).

## 3. Decisiones de diseño y arquitectura

- **Tailwind v4** con el plugin `@tailwindcss/vite`; tokens en `src/index.css` (`@theme`). El terracota `#B8664D` se usa en acentos y una variante más oscura (`clay-strong`) en botones y enlaces para cumplir contraste AA.
- **UX/UI Pro Max** no estaba disponible en el entorno de construcción, así que no se usó; se aplicaron criterios propios de diseño de producto, accesibilidad y responsive.
- **Responsive**: móvil (base) → tableta (`md`) → escritorio (`lg`). Panel: barra inferior en móvil, rail lateral en tableta, sidebar en escritorio. Agenda: día en móvil; día + mes con calendario lateral en tableta; día, semana (rejilla por horas) y mes en escritorio. Diálogos: bottom sheet en móvil y panel lateral en `md+`. Sin tablas: listas y tarjetas.
- **Zonas horarias**: instantes en `timestamptz`; horarios laborales como hora local por día; la conversión ocurre en SQL con `AT TIME ZONE businesses.timezone`. El navegador muestra con `Intl` en la zona del negocio.
- **Anti doble reserva**: `create_booking` bloquea la fila del negocio, expira pendientes vencidas, revalida con `get_available_slots` y la restricción `EXCLUDE` (`appointments_no_overlap`) es la red final. La cita solo se crea al confirmar el último paso, así que no hay reservas incompletas bloqueando horarios. Las `pending` retienen el hueco `pending_hold_hours` y luego pasan a `expired`.
- **Seguridad**: RLS en todas las tablas; el público solo lee negocios publicados, servicios activos y horarios; reservar, consultar y cancelar como invitado pasa por RPC con token secreto. Fotos de referencia en bucket privado, con URLs firmadas de 10 minutos y nombres UUID.

## 4. Estructura

```
src/
  auth/            registro, acceso, recuperación, sesión
  components/ui/   botones, campos, Sheet, calendario, estados
  features/
    public/        página del negocio y flujo de reserva por pasos
    admin/         layout, contexto de negocio, resumen, onboarding
    agenda/        día, semana, mes, detalle de cita
    services/ availability/ clients/ settings/
  lib/             supabase, fechas/zonas horarias, errores, storage
supabase/migrations/
```

## 5. Pruebas manuales recomendadas

- Anchos 320, 375, 390, 430, 768, 820, 1024, 1280 y 1440 px: sin scroll horizontal, controles de 44 px.
- Dos navegadores reservando el mismo hueco a la vez: solo uno gana, el otro ve "ese horario acaba de ocuparse".
- Con otro usuario/negocio: confirmar que no puede leer citas, clientes ni fotos ajenas.
- Subida de fotos: tipo no válido, más de 5 MB, más del máximo, y sin conexión.
- Sesión caducada en el panel: vuelve a `/acceso`.

## 6. Pendiente / siguientes pasos

- Correos transaccionales (confirmación/recordatorios): requieren una Edge Function y un proveedor de correo.
- Invitar miembros al equipo (el esquema y las políticas ya soportan roles `owner/admin/staff`; falta la interfaz).
- "Mis reservas" para cuentas de cliente (la reserva ya guarda `customer_user_id`).
- Reprogramar citas (hoy `start_at/end_at` son inmutables por trigger).
- Protección anti spam en reservas anónimas (Turnstile/hCaptcha) y límites de tasa.
- Tareas programadas con `pg_cron` para expirar pendientes en segundo plano (hay un ejemplo al final de la migración 3).
