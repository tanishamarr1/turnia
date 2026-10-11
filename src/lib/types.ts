export type Role = 'owner' | 'admin' | 'staff'
export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'expired'

export interface Business {
  id: string
  slug: string
  name: string
  description: string | null
  logo_url: string | null
  cover_url: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  timezone: string
  min_notice_minutes: number
  max_advance_days: number
  buffer_minutes: number
  slot_step_minutes: number
  auto_confirm: boolean
  pending_hold_hours: number
  max_reference_images: number
  is_published: boolean
  onboarding_completed: boolean
}

export type PublicBusiness = Pick<
  Business,
  | 'id' | 'slug' | 'name' | 'description' | 'logo_url' | 'cover_url' | 'phone' | 'email'
  | 'address' | 'city' | 'timezone' | 'max_advance_days' | 'max_reference_images' | 'auto_confirm'
>

export interface Service {
  id: string
  business_id: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  duration_minutes: number
  image_url: string | null
  is_active: boolean
  sort_order: number
}

export interface HourRow {
  id?: string
  business_id?: string
  weekday: number // 0 = domingo ... 6 = sábado
  kind: 'work' | 'break'
  start_time: string // HH:MM[:SS]
  end_time: string
}

export interface Blocked {
  id: string
  business_id: string
  start_at: string
  end_at: string
  kind: 'time_block' | 'day_off' | 'vacation'
  reason: string | null
}

export interface Appointment {
  id: string
  business_id: string
  service_id: string | null
  customer_user_id: string | null
  customer_name: string
  customer_email: string
  customer_phone: string
  start_at: string
  end_at: string
  status: AppointmentStatus
  notes: string | null
  internal_notes: string | null
  access_token: string
  service_name: string
  price_cents: number
  currency: string
  expires_at: string | null
  cancelled_at: string | null
  cancelled_by: 'customer' | 'business' | null
  created_at: string
}

export interface AppointmentReference {
  id: string
  appointment_id: string
  storage_path: string
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
}

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string | null
  appointment_id: string | null
  read_at: string | null
  created_at: string
}

export interface Slot {
  slot_start: string
  slot_end: string
}
