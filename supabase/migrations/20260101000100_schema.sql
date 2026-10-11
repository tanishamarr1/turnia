-- =====================================================================
-- Turnia · Esquema base
--
-- Fechas y zonas horarias:
--   * Todos los instantes (start_at, end_at, ...) se guardan como timestamptz (UTC internamente).
--   * Cada negocio tiene su zona IANA en businesses.timezone (ej. America/Santo_Domingo).
--   * Los horarios laborales (business_hours) se guardan como hora local del negocio (time) por
--     día de la semana (0 = domingo ... 6 = sábado). La función get_available_slots los convierte
--     a instantes con "AT TIME ZONE businesses.timezone", así el horario de verano se respeta.
--   * El navegador recibe instantes ISO y los muestra en la zona del negocio con Intl.DateTimeFormat.
-- =====================================================================

create extension if not exists btree_gist;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- businesses ----------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 48),
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 1000),
  logo_url text,
  cover_url text,
  phone text,
  email text,
  address text,
  city text,
  timezone text not null default 'America/Santo_Domingo',
  min_notice_minutes integer not null default 120 check (min_notice_minutes between 0 and 43200),
  max_advance_days integer not null default 60 check (max_advance_days between 1 and 365),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 240),
  slot_step_minutes integer not null default 15 check (slot_step_minutes in (5, 10, 15, 20, 30, 60)),
  auto_confirm boolean not null default true,
  pending_hold_hours integer not null default 24 check (pending_hold_hours between 1 and 168),
  max_reference_images integer not null default 3 check (max_reference_images between 0 and 10),
  is_published boolean not null default true,
  onboarding_completed boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger businesses_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

create or replace function public.validate_business()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'invalid_timezone';
  end if;
  return new;
end $$;
create trigger businesses_validate before insert or update of timezone on public.businesses
  for each row execute function public.validate_business();

-- ---------- business_members ----------
create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on public.business_members (user_id);

-- ---------- services ----------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 600),
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'DOP' check (currency ~ '^[A-Z]{3}$'),
  duration_minutes integer not null check (duration_minutes between 5 and 720),
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_business_idx on public.services (business_id, sort_order);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ---------- business_hours ----------
-- kind = 'work' (turno laboral) o 'break' (pausa). Varios turnos por día permitidos.
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  kind text not null default 'work' check (kind in ('work', 'break')),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index business_hours_idx on public.business_hours (business_id, weekday);

-- ---------- blocked_dates ----------
create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  kind text not null default 'time_block' check (kind in ('time_block', 'day_off', 'vacation')),
  reason text check (char_length(reason) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index blocked_dates_idx on public.blocked_dates (business_id, start_at, end_at);

-- ---------- appointments ----------
-- Estados: pending (espera confirmación del negocio), confirmed, cancelled, completed,
-- no_show, expired (una reserva pending que no se confirmó a tiempo).
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  customer_user_id uuid references auth.users (id) on delete set null,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_email text not null,
  customer_phone text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'expired')),
  notes text check (char_length(notes) <= 500),
  internal_notes text check (char_length(internal_notes) <= 1000),
  -- Token secreto para que el cliente (invitado) consulte o cancele su reserva sin cuenta.
  access_token uuid not null unique default gen_random_uuid(),
  -- Copia (snapshot) del servicio al reservar, para que cambiar el servicio no altere el historial.
  service_name text not null,
  price_cents integer not null default 0,
  currency text not null default 'DOP',
  expires_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('customer', 'business')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  -- Garantía final contra dobles reservas: dos citas activas del mismo negocio no pueden solaparse,
  -- aunque dos peticiones lleguen exactamente al mismo tiempo.
  constraint appointments_no_overlap exclude using gist (
    business_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);
create index appointments_business_start_idx on public.appointments (business_id, start_at);
create index appointments_customer_idx on public.appointments (customer_user_id);
create index appointments_email_idx on public.appointments (business_id, lower(customer_email));
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

-- Campos que nadie puede modificar por UPDATE directo (reprogramar requerirá una función dedicada).
create or replace function public.guard_appointment_update()
returns trigger language plpgsql as $$
begin
  if new.business_id <> old.business_id
     or new.access_token <> old.access_token
     or new.start_at <> old.start_at
     or new.end_at <> old.end_at then
    raise exception 'immutable_fields';
  end if;
  return new;
end $$;
create trigger appointments_guard before update on public.appointments
  for each row execute function public.guard_appointment_update();

-- ---------- appointment_references ----------
create table public.appointment_references (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  storage_path text not null unique,
  file_name text,
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  created_at timestamptz not null default now()
);
create index appointment_references_appt_idx on public.appointment_references (appointment_id);

-- ---------- notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  appointment_id uuid references public.appointments (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create or replace function public.notify_new_appointment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (business_id, user_id, type, title, body, appointment_id)
  select new.business_id, m.user_id, 'appointment_created',
         case when new.status = 'pending' then 'Reserva por confirmar' else 'Nueva reserva' end,
         new.customer_name || ' - ' || new.service_name,
         new.id
  from public.business_members m
  where m.business_id = new.business_id;
  return new;
end $$;
create trigger appointments_notify_insert after insert on public.appointments
  for each row execute function public.notify_new_appointment();

create or replace function public.notify_customer_cancellation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (business_id, user_id, type, title, body, appointment_id)
  select new.business_id, m.user_id, 'appointment_cancelled', 'Reserva cancelada por el cliente',
         new.customer_name || ' - ' || new.service_name, new.id
  from public.business_members m
  where m.business_id = new.business_id;
  return new;
end $$;
create trigger appointments_notify_cancel after update of status on public.appointments
  for each row
  when (old.status is distinct from new.status and new.status = 'cancelled' and new.cancelled_by = 'customer')
  execute function public.notify_customer_cancellation();
