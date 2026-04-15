export type UserLanguage = 'ru' | 'ce';
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface UserDto {
  id: string;
  phone: string;
  name: string;
  language: UserLanguage;
  email: string | null;
  email_verified: boolean;
}

export interface CategoryDto {
  id: string;
  name_ru: string;
  name_ce: string;
  icon: string;
}

export interface StaffItemDto {
  id: string;
  name: string;
  role: string;
  avatar_url: string | null;
}

export interface ServiceItemDto {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

export interface BusinessListItemDto {
  id: string;
  name: string;
  address: string;
  phone: string;
  photos: string[];
  working_hours: Record<string, { open: string; close: string } | null>;
  instagram_url: string | null;
  website_url: string | null;
  category_id: string;
  category_name_ru: string;
  category_name_ce: string;
  category_icon: string;
  avg_rating: number | null;
  review_count: number;
  distance_m: number | null;
  lat: number | null;
  lng: number | null;
  search_match_type?: 'business' | 'staff' | 'service' | null;
  search_match_value?: string | null;
}

export interface BusinessDetailDto extends BusinessListItemDto {
  slug: string | null;
  portfolio_photos: string[];
  reminder_settings: {
    remind_24h: boolean;
    remind_30min: boolean;
  };
  cancellation_threshold_minutes: number;
  category_name: string;
  staff: StaffItemDto[];
  services: ServiceItemDto[];
}

export interface SlotItemDto {
  id: string;
  staff_id: string;
  staff_name: string;
  date: string;
  start_time: string;
  is_booked: boolean;
}

export interface BookingItemDto {
  id: string;
  status: BookingStatus;
  slot_date: string;
  slot_start_time: string;
  service_name: string;
  service_price: number;
  business_id: string;
  business_name: string;
  staff_name: string;
  cancellation_threshold_minutes: number;
  created_at: string;
  cancelled_at: string | null;
}

export interface ReviewItemDto {
  id: string;
  rating: number;
  comment: string | null;
  reply_text: string | null;
  user_name_short: string;
  created_at: string;
}

export interface FavoriteItemDto {
  id: string;
  business_id: string | null;
  staff_id: string | null;
  created_at: string;
}

export interface FavoriteBusinessItemDto {
  id: string;
  business_id: string;
  business_name: string;
  business_address: string;
  business_phone: string;
  category_name_ru: string;
  category_name_ce: string;
  created_at: string;
}

export interface FavoriteStaffItemDto {
  id: string;
  staff_id: string;
  staff_name: string;
  staff_avatar_url: string | null;
  business_id: string;
  business_name: string;
  created_at: string;
}

export interface GetFavoritesResponseDto {
  businesses: FavoriteBusinessItemDto[];
  staff: FavoriteStaffItemDto[];
}

export type AuthResponseDto =
  | { requiresEmailVerification: true }
  | { requiresEmailVerification: false; accessToken: string; refreshToken: string; user: UserDto };

export interface PaginatedResponseDto<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface ApiErrorDto {
  error: {
    code: string;
    message: string;
  };
}

export type ChatMessageType = 'text' | 'image';
export type ChatSenderRole = 'client' | 'staff';

export interface ChatMessageDto {
  id: string;
  booking_id: string;
  sender_role: ChatSenderRole;
  message_type: ChatMessageType;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface ChatMessagesResponseDto {
  messages: ChatMessageDto[];
  next_cursor: string | null;
}

export interface ChatUnreadCountDto {
  unread_count: number;
}

export interface BusinessBookingItemDto {
  id: string;
  status: BookingStatus;
  source: string;
  slot_date: string;
  slot_start_time: string;
  service_name: string;
  service_price: number;
  client_name: string | null;
  client_phone: string | null;
  staff_id: string;
  staff_name: string;
  created_at: string;
  cancelled_at: string | null;
}

export interface StaffStatItemDto {
  staff_id: string;
  staff_name: string;
  bookings_count: number;
  show_rate_pct: number;
}

export interface BusinessStatsDto {
  period: 'day' | 'week' | 'month';
  bookings_count: number;
  avg_rating: number | null;
  show_rate_pct: number;
  by_staff: StaffStatItemDto[];
  by_source: {
    app: number;
    walk_in: number;
  };
}
