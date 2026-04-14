import { type BusinessBookingItemDto } from '@mettig/shared';

export interface BusinessBookingsResponseDto {
  bookings: BusinessBookingItemDto[];
  total: number;
  limit: number | null;
  offset: number;
  has_more: boolean;
}

export type TBookingsPeriod = 'today' | 'week' | 'month';
