import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserLanguage = 'ru' | 'ce';
export type StaffRole = 'admin' | 'employee';
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type BookingSource = 'app' | 'walk_in';

// ─── Table interfaces ─────────────────────────────────────────────────────────

export interface UserTable {
  id: Generated<string>;
  phone: string;
  name: string;
  language: ColumnType<UserLanguage, UserLanguage | undefined, UserLanguage>;
  created_at: ColumnType<Date, never, never>;
}

export interface CategoryTable {
  id: Generated<string>;
  name_ru: string;
  name_ce: string;
  icon: string;
  sort_order: number;
}

export interface BusinessTable {
  id: Generated<string>;
  name: string;
  category_id: string;
  address: string;
  location: string; // PostGIS geography(Point,4326) — returned as WKT/GeoJSON string
  phone: string;
  instagram_url: string | null;
  website_url: string | null;
  working_hours: ColumnType<Record<string, unknown>, string, string>;
  photos: ColumnType<string[], string, string>;
  portfolio_photos: ColumnType<string[], string, string>;
  cancellation_threshold_minutes: number;
  reminder_settings: ColumnType<Record<string, unknown>, string, string>;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: ColumnType<Date, never, never>;
}

export interface StaffTable {
  id: Generated<string>;
  business_id: string;
  user_id: string;
  name: string;
  role: StaffRole;
  avatar_url: string | null;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
}

export interface ServiceTable {
  id: Generated<string>;
  business_id: string;
  name: string;
  price: number;
  duration_minutes: number;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
}

export interface SlotTable {
  id: Generated<string>;
  staff_id: string;
  date: ColumnType<Date, string | Date, string | Date>;
  start_time: string; // HH:MM
  is_booked: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: ColumnType<Date, never, never>;
}

export interface BookingTable {
  id: Generated<string>;
  user_id: string;
  slot_id: string;
  service_id: string;
  business_id: string;
  staff_id: string;
  status: ColumnType<BookingStatus, BookingStatus | undefined, BookingStatus>;
  cancelled_at: Date | null;
  source: ColumnType<BookingSource, BookingSource | undefined, BookingSource>;
  created_at: ColumnType<Date, never, never>;
}

export interface ReviewTable {
  id: Generated<string>;
  booking_id: string;
  user_id: string;
  business_id: string;
  rating: number;
  text: string;
  reply_text: string | null;
  reply_at: Date | null;
  is_reported: ColumnType<boolean, boolean | undefined, boolean>;
  reported_at: Date | null;
  reported_reason: string | null;
  created_at: ColumnType<Date, never, never>;
}

export interface FavoriteTable {
  id: Generated<string>;
  user_id: string;
  business_id: string | null;
  staff_id: string | null;
  created_at: ColumnType<Date, never, never>;
}

export interface EventTable {
  id: Generated<string>;
  event_type: string;
  session_id: string | null;
  anonymous_user_hash: string | null;
  user_id: string | null;
  payload: ColumnType<Record<string, unknown>, string, string>;
  device_type: string | null;
  app_version: string | null;
  lat: ColumnType<string | null, string | null, string | null>;
  lng: ColumnType<string | null, string | null, string | null>;
  created_at: ColumnType<Date, never, never>;
}

export type NotificationChannel = 'whatsapp' | 'sms';
export type NotificationEventType = 'booking_created' | 'booking_cancelled';
export type NotificationStatus = 'sent' | 'failed';

export interface NotificationLogTable {
  id: Generated<string>;
  booking_id: string | null;
  channel: NotificationChannel;
  event_type: NotificationEventType;
  phone: string;
  message: string;
  status: NotificationStatus;
  error_message: string | null;
  created_at: ColumnType<Date, never, never>;
}

export interface PushTokenTable {
  id: Generated<string>;
  user_id: string;
  token: string;
  created_at: ColumnType<Date, never, never>;
}

// ─── Database schema ──────────────────────────────────────────────────────────

export interface Database {
  users: UserTable;
  categories: CategoryTable;
  businesses: BusinessTable;
  staff: StaffTable;
  services: ServiceTable;
  slots: SlotTable;
  bookings: BookingTable;
  reviews: ReviewTable;
  favorites: FavoriteTable;
  events: EventTable;
  notification_log: NotificationLogTable;
  push_tokens: PushTokenTable;
}

// ─── Convenience types ────────────────────────────────────────────────────────

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export type Category = Selectable<CategoryTable>;
export type NewCategory = Insertable<CategoryTable>;

export type Business = Selectable<BusinessTable>;
export type NewBusiness = Insertable<BusinessTable>;
export type BusinessUpdate = Updateable<BusinessTable>;

export type Staff = Selectable<StaffTable>;
export type NewStaff = Insertable<StaffTable>;
export type StaffUpdate = Updateable<StaffTable>;

export type Service = Selectable<ServiceTable>;
export type NewService = Insertable<ServiceTable>;
export type ServiceUpdate = Updateable<ServiceTable>;

export type Slot = Selectable<SlotTable>;
export type NewSlot = Insertable<SlotTable>;

export type Booking = Selectable<BookingTable>;
export type NewBooking = Insertable<BookingTable>;
export type BookingUpdate = Updateable<BookingTable>;

export type Review = Selectable<ReviewTable>;
export type NewReview = Insertable<ReviewTable>;
export type ReviewUpdate = Updateable<ReviewTable>;

export type Favorite = Selectable<FavoriteTable>;
export type NewFavorite = Insertable<FavoriteTable>;

export type Event = Selectable<EventTable>;
export type NewEvent = Insertable<EventTable>;

export type NotificationLog = Selectable<NotificationLogTable>;
export type NewNotificationLog = Insertable<NotificationLogTable>;

export type PushToken = Selectable<PushTokenTable>;
export type NewPushToken = Insertable<PushTokenTable>;
