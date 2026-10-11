-- =====================================================================
-- Turnia · Seguridad: funciones auxiliares, RLS y Storage
-- =====================================================================

-- ---------- funciones auxiliares (SECURITY DEFINER para evitar recursión de RLS) ----------
create or replace function public.try_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

create or replace function public.is_business_member(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid()
  )
$$;

create or replace function public.is_business_admin(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid() and role in ('owner', 'admin')
  )
$$;

create or replace function public.is_business_owner(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid() and role = 'owner'
  )
$$;

create or replace function public.is_business_published(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.businesses where id = p_business_id and is_published)
$$;

-- ---------- activar RLS ----------
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.services enable row level security;
alter table public.business_hours enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_references enable row level security;
alter table public.notifications enable row level security;

-- ---------- profiles ----------
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- businesses ----------
-- Lectura pública solo de negocios publicados. La creación se hace con la función create_business().
create policy businesses_select on public.businesses
  for select to anon, authenticated
  using (is_published or public.is_business_member(id));
create policy businesses_update on public.businesses
  for update to authenticated
  using (public.is_business_admin(id)) with check (public.is_business_admin(id));
create policy businesses_delete on public.businesses
  for delete to authenticated using (public.is_business_owner(id));

-- ---------- business_members ----------
create policy members_select on public.business_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_business_member(business_id));
create policy members_insert on public.business_members
  for insert to authenticated with check (public.is_business_owner(business_id));
create policy members_update on public.business_members
  for update to authenticated
  using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));
create policy members_delete on public.business_members
  for delete to authenticated using (public.is_business_owner(business_id));

-- ---------- services ----------
create policy services_select on public.services
  for select to anon, authenticated
  using ((is_active and public.is_business_published(business_id)) or public.is_business_member(business_id));
create policy services_insert on public.services
  for insert to authenticated with check (public.is_business_admin(business_id));
create policy services_update on public.services
  for update to authenticated
  using (public.is_business_admin(business_id)) with check (public.is_business_admin(business_id));
create policy services_delete on public.services
  for delete to authenticated using (public.is_business_admin(business_id));

-- ---------- business_hours ----------
create policy hours_select on public.business_hours
  for select to anon, authenticated
  using (public.is_business_published(business_id) or public.is_business_member(business_id));
create policy hours_write on public.business_hours
  for all to authenticated
  using (public.is_business_admin(business_id)) with check (public.is_business_admin(business_id));

-- ---------- blocked_dates (solo miembros; el público solo ve el efecto vía get_available_slots) ----------
create policy blocked_select on public.blocked_dates
  for select to authenticated using (public.is_business_member(business_id));
create policy blocked_insert on public.blocked_dates
  for insert to authenticated with check (public.is_business_member(business_id));
create policy blocked_delete on public.blocked_dates
  for delete to authenticated using (public.is_business_member(business_id));

-- ---------- appointments ----------
-- Los clientes NO leen la tabla directamente: usan las funciones con token (get_booking_by_token).
-- Las reservas se crean únicamente con create_booking(), que valida disponibilidad en el servidor.
create policy appointments_select on public.appointments
  for select to authenticated using (public.is_business_member(business_id));
create policy appointments_update on public.appointments
  for update to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

-- ---------- appointment_references ----------
create policy references_select on public.appointment_references
  for select to authenticated using (public.is_business_member(business_id));
create policy references_delete on public.appointment_references
  for delete to authenticated using (public.is_business_member(business_id));

-- ---------- notifications ----------
create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- =====================================================================
-- Storage
--   business-assets        (público): logos, portadas e imágenes de servicios. Ruta: {business_id}/...
--   appointment-references (PRIVADO): fotos de referencia. Ruta: {business_id}/{appointment_id}/{uuid}.ext
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('business-assets', 'business-assets', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('appointment-references', 'appointment-references', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Un invitado solo puede subir a la carpeta de una reserva que acaba de crear (últimos 30 minutos)
-- y cuyo UUID conoce. El nombre del archivo es un UUID aleatorio (no predecible).
create or replace function public.can_upload_reference(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.appointments a
    where a.id = public.try_uuid((string_to_array(p_name, '/'))[2])
      and a.business_id = public.try_uuid((string_to_array(p_name, '/'))[1])
      and a.status in ('pending', 'confirmed')
      and a.created_at > now() - interval '30 minutes'
  )
$$;

create policy assets_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'business-assets'
    and public.is_business_admin(public.try_uuid((storage.foldername(name))[1])));
create policy assets_update on storage.objects
  for update to authenticated
  using (bucket_id = 'business-assets'
    and public.is_business_admin(public.try_uuid((storage.foldername(name))[1])));
create policy assets_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'business-assets'
    and public.is_business_admin(public.try_uuid((storage.foldername(name))[1])));

create policy references_upload on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'appointment-references' and public.can_upload_reference(name));
create policy references_read on storage.objects
  for select to authenticated
  using (bucket_id = 'appointment-references'
    and public.is_business_member(public.try_uuid((storage.foldername(name))[1])));
create policy references_remove on storage.objects
  for delete to authenticated
  using (bucket_id = 'appointment-references'
    and public.is_business_member(public.try_uuid((storage.foldername(name))[1])));
