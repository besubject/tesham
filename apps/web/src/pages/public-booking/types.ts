export interface StaffMember {
  id: string;
  name: string;
  role: string | null;
  avatar_url: string | null;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

export interface BusinessData {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  photos: string[];
  avg_rating: number | null;
  review_count: number;
  category_name: string;
  category_icon: string;
  slug: string;
  staff: StaffMember[];
  services: Service[];
  instagram_url: string | null;
  website_url: string | null;
}

export interface SlotItem {
  id: string;
  staff_id: string;
  staff_name: string;
  date: string;
  start_time: string;
  is_booked: boolean;
}

export interface DayOption {
  label: string;
  value: string;
}

export type BookingStep = 'staff' | 'service' | 'datetime' | 'verify' | 'done';
