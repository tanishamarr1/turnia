-- =====================================================================
-- Turnia · Funciones de servidor (RPC)
-- Todas las operaciones sensibles pasan por aquí; el navegador solo usa la clave pública.
-- =====================================================================

-- ---------- Disponibilidad de un día ----------
-- Une: turnos laborales - pausas - bloqueos - citas activas (con tiempo extra entre citas),
-- aplicando anticipación mínima y límite de días futuros, siempre en la zona horaria del negocio.
create or replace function public.get_available_slots(
  p_business_id uuid, p_service_id uuid, p_date date
)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  b public.businesses%rowtype;
  s public.services%rowtype;
  v_weekday int;
  v_now timestamptz := now();
  v_earliest timestamptz;
  v_today date;
begin
  select * into b from public.businesses where id = p_business_id and is_published;
  if not found then return; end if;
  select * into s from public.services
    where id = p_service_id and business_id = p_business_id and is_active;
  if not found then return; end if;

  v_today := (v_now at time zone b.timezone)::date;
  if p_date < v_today or p_date > v_today + b.max_advance_days then return; end if;

  v_earliest := v_now + make_interval(mins => b.min_notice_minutes);
  v_weekday := extract(dow from p_date)::int;

  return query
  with work as (
    select (p_date + h.start_time) at time zone b.timezone as w_start,
           (p_date + h.end_time) at time zone b.timezone as w_end
    from public.business_hours h
    where h.business_id = p_business_id and h.weekday = v_weekday and h.kind = 'work'
  ),
  candidates as (
    select g as c_start, g + make_interval(mins => s.duration_minutes) as c_end
    from work w,
         generate_series(
           w.w_start,
           w.w_end - make_interval(mins => s.duration_minutes),
           make_interval(mins => b.slot_step_minutes)
         ) g
  )
  select c.c_start, c.c_end
  from candidates c
  where c.c_start >= v_earliest
    and not exists (
      select 1 from public.business_hours h
      where h.business_id = p_business_id and h.weekday = v_weekday and h.kind = 'break'
        and tstzrange((p_date + h.start_time) at time zone b.timezone,
                      (p_date + h.end_time) at time zone b.timezone, '[)')
            && tstzrange(c.c_start, c.c_end, '[)')
    )
    and not exists (
      select 1 from public.blocked_dates d
      where d.business_id = p_business_id
        and tstzrange(d.start_at, d.end_at, '[)') && tstzrange(c.c_start, c.c_end, '[)')
    )
    and not exists (
      select 1 from public.appointments a
      where a.business_id = p_business_id
        and a.status in ('pending', 'confirmed')
        and (a.status = 'confirmed' or a.expires_at is null or a.expires_at > v_now)
        and tstzrange(a.start_at - make_interval(mins => b.buffer_minutes),
                      a.end_at + make_interval(mins => b.buffer_minutes), '[)')
            && tstzrange(c.c_start, c.c_end, '[)')
    )
  order by c.c_start;
end $$;

-- ---------- Fechas con al menos un hueco (para pintar el calendario) ----------
create or replace function public.get_available_dates(
  p_business_id uuid, p_service_id uuid, p_from date, p_to date
)
returns setof date
language plpgsql stable security definer set search_path = public as $$
declare
  v_day date;
begin
  if p_to < p_from or p_to - p_from > 62 then return; end if;
  for v_day in
    select d::date from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
  loop
    if exists (select 1 from public.get_available_slots(p_business_id, p_service_id, v_day)) then
      return next v_day;
    end if;
  end loop;
end $$;

-- ---------- Crear reserva (valida de nuevo en el servidor y evita carreras) ----------
-- Estrategia anti doble reserva:
--   1) Se bloquea la fila del negocio (FOR UPDATE): las reservas del mismo negocio se serializan.
--   2) Se expiran las reservas 'pending' vencidas, liberando su hueco.
--   3) Se revalida el hueco con get_available_slots.
--   4) La restricción EXCLUDE appointments_no_overlap es la red de seguridad final.
-- Las reservas incompletas no bloquean nada: la cita solo existe al confirmar el último paso.
-- Una reserva 'pending' retiene el hueco hasta businesses.pending_hold_hours (o hasta la hora de la cita).
create or replace function public.create_booking(
  p_business_id uuid, p_service_id uuid, p_start timestamptz,
  p_name text, p_email text, p_phone text, p_notes text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.businesses%rowtype;
  s public.services%rowtype;
  v_end timestamptz;
  v_status text;
  v_expires timestamptz;
  v_id uuid;
  v_token uuid;
begin
  p_name := btrim(coalesce(p_name, ''));
  p_email := lower(btrim(coalesce(p_email, '')));
  p_phone := btrim(coalesce(p_phone, ''));
  p_notes := nullif(btrim(coalesce(p_notes, '')), '');

  if char_length(p_name) < 2 or char_length(p_name) > 120 then raise exception 'invalid_name'; end if;
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if char_length(p_phone) < 7 or char_length(p_phone) > 25 then raise exception 'invalid_phone'; end if;
  if p_notes is not null and char_length(p_notes) > 500 then raise exception 'invalid_notes'; end if;

  select * into b from public.businesses where id = p_business_id and is_published for update;
  if not found then raise exception 'business_not_found'; end if;

  select * into s from public.services
    where id = p_service_id and business_id = p_business_id and is_active;
  if not found then raise exception 'service_not_found'; end if;

  update public.appointments
     set status = 'expired'
   where business_id = p_business_id and status = 'pending'
     and expires_at is not null and expires_at <= now();

  if (select count(*) from public.appointments
       where business_id = p_business_id and lower(customer_email) = p_email
         and status in ('pending', 'confirmed') and start_at > now()) >= 5 then
    raise exception 'too_many_bookings';
  end if;

  if not exists (
    select 1
    from public.get_available_slots(p_business_id, p_service_id, (p_start at time zone b.timezone)::date) g
    where g.slot_start = p_start
  ) then
    raise exception 'slot_unavailable';
  end if;

  v_end := p_start + make_interval(mins => s.duration_minutes);
  v_status := case when b.auto_confirm then 'confirmed' else 'pending' end;
  v_expires := case when b.auto_confirm then null
                    else least(now() + make_interval(hours => b.pending_hold_hours), p_start) end;

  insert into public.appointments (
    business_id, service_id, customer_user_id, customer_name, customer_email, customer_phone,
    start_at, end_at, status, notes, service_name, price_cents, currency, expires_at
  ) values (
    p_business_id, p_service_id, auth.uid(), p_name, p_email, p_phone,
    p_start, v_end, v_status, p_notes, s.name, s.price_cents, s.currency, v_expires
  )
  returning id, access_token into v_id, v_token;

  return jsonb_build_object(
    'appointment_id', v_id, 'access_token', v_token, 'status', v_status,
    'start_at', p_start, 'end_at', v_end
  );
exception
  when exclusion_violation then
    raise exception 'slot_unavailable';
end $$;

-- ---------- Consultar y cancelar con token (clientes invitados) ----------
create or replace function public.get_booking_by_token(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb;
begin
  select jsonb_build_object(
    'id', a.id, 'status',
      case when a.status = 'pending' and a.expires_at is not null and a.expires_at <= now()
           then 'expired' else a.status end,
    'start_at', a.start_at, 'end_at', a.end_at,
    'service_name', a.service_name, 'price_cents', a.price_cents, 'currency', a.currency,
    'customer_name', a.customer_name, 'notes', a.notes,
    'references_count', (select count(*) from public.appointment_references x where x.appointment_id = a.id),
    'business', jsonb_build_object(
      'name', b.name, 'slug', b.slug, 'timezone', b.timezone, 'address', b.address, 'phone', b.phone
    )
  ) into r
  from public.appointments a
  join public.businesses b on b.id = a.business_id
  where a.access_token = p_token;

  if r is null then raise exception 'booking_not_found'; end if;
  return r;
end $$;

create or replace function public.cancel_booking_by_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a public.appointments%rowtype;
begin
  select * into a from public.appointments where access_token = p_token for update;
  if not found then raise exception 'booking_not_found'; end if;
  if a.status not in ('pending', 'confirmed') or a.start_at <= now() then
    raise exception 'cannot_cancel';
  end if;
  update public.appointments
     set status = 'cancelled', cancelled_at = now(), cancelled_by = 'customer'
   where id = a.id;
  return public.get_booking_by_token(p_token);
end $$;

-- ---------- Registrar una foto de referencia ya subida ----------
create or replace function public.add_appointment_reference(
  p_token uuid, p_path text, p_file_name text, p_mime text, p_size bigint
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.appointments%rowtype;
  v_max int;
begin
  select * into a from public.appointments where access_token = p_token;
  if not found then raise exception 'booking_not_found'; end if;
  if a.created_at < now() - interval '30 minutes' then raise exception 'upload_window_closed'; end if;
  if p_path not like a.business_id::text || '/' || a.id::text || '/%' then
    raise exception 'invalid_path';
  end if;
  select max_reference_images into v_max from public.businesses where id = a.business_id;
  if (select count(*) from public.appointment_references where appointment_id = a.id) >= v_max then
    raise exception 'too_many_references';
  end if;
  insert into public.appointment_references (appointment_id, business_id, storage_path, file_name, mime_type, size_bytes)
  values (a.id, a.business_id, p_path, left(p_file_name, 200), p_mime, p_size);
end $$;

-- ---------- Alta de negocio, horarios y utilidades del panel ----------
create or replace function public.is_slug_available(p_slug text)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.businesses where slug = lower(btrim(p_slug)))
$$;

create or replace function public.create_business(
  p_name text, p_slug text, p_timezone text default 'America/Santo_Domingo'
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  insert into public.businesses (name, slug, timezone, created_by)
  values (btrim(p_name), lower(btrim(p_slug)), p_timezone, auth.uid())
  returning id into v_id;

  insert into public.business_members (business_id, user_id, role) values (v_id, auth.uid(), 'owner');

  -- Horario inicial de lunes a viernes, editable en la incorporación.
  insert into public.business_hours (business_id, weekday, kind, start_time, end_time)
  select v_id, d, 'work', time '09:00', time '17:00' from generate_series(1, 5) d
  union all
  select v_id, d, 'break', time '12:00', time '13:00' from generate_series(1, 5) d;

  return v_id;
exception
  when unique_violation then
    raise exception 'slug_taken';
end $$;

create or replace function public.replace_business_hours(p_business_id uuid, p_hours jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_business_admin(p_business_id) then raise exception 'forbidden'; end if;

  delete from public.business_hours where business_id = p_business_id;

  insert into public.business_hours (business_id, weekday, kind, start_time, end_time)
  select p_business_id, x.weekday, x.kind, x.start_time, x.end_time
  from jsonb_to_recordset(p_hours) as x(weekday smallint, kind text, start_time time, end_time time);
end $$;

-- ---------- Permisos de ejecución ----------
revoke all on function public.is_slug_available(text) from public;
revoke all on function public.create_business(text, text, text) from public;
revoke all on function public.replace_business_hours(uuid, jsonb) from public;
grant execute on function public.is_slug_available(text) to authenticated;
grant execute on function public.create_business(text, text, text) to authenticated;
grant execute on function public.replace_business_hours(uuid, jsonb) to authenticated;

grant execute on function public.get_available_slots(uuid, uuid, date) to anon, authenticated;
grant execute on function public.get_available_dates(uuid, uuid, date, date) to anon, authenticated;
grant execute on function public.create_booking(uuid, uuid, timestamptz, text, text, text, text) to anon, authenticated;
grant execute on function public.get_booking_by_token(uuid) to anon, authenticated;
grant execute on function public.cancel_booking_by_token(uuid) to anon, authenticated;
grant execute on function public.add_appointment_reference(uuid, text, text, text, bigint) to anon, authenticated;

-- ---------- (Opcional) Expirar reservas pendientes en segundo plano ----------
-- create_booking ya las expira al reservar. Si activas la extensión pg_cron en Supabase:
--   select cron.schedule('turnia-expire-pending', '*/10 * * * *',
--     $$ update public.appointments set status = 'expired'
--        where status = 'pending' and expires_at is not null and expires_at <= now() $$);
