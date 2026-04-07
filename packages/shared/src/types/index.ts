export type UserLanguage = 'ru' | 'ce';
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface UserDto {
  id: string;
  phone: string;
  name: string;
  language: UserLanguage;
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
}

export interface BusinessDetailDto extends BusinessListItemDto {
  portfolio_photos: string[];
  reminder_settings: {
    remind_24h: boolean;
    remind_30min: boolean;
  };
  cancellation_threshold_minutes: number;
  category_name: string;
  staff: StaffItemDto[];
  services: ServiceItemDto[];
  lat: number | null;
  lng: number | null;
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

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

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
