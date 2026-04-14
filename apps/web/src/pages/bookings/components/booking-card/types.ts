import { type BusinessBookingItemDto } from '@mettig/shared';

export interface BookingCardProps {
  booking: BusinessBookingItemDto;
  unreadCount: number;
  onOpenChat: (booking: BusinessBookingItemDto) => void;
  onComplete: (booking: BusinessBookingItemDto) => void;
  onCancel: (booking: BusinessBookingItemDto) => void;
  isCompleting: boolean;
  isCancelling: boolean;
}
