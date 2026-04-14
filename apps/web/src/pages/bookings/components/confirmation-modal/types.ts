import { type BusinessBookingItemDto } from '@mettig/shared';

export type BookingConfirmationAction = 'completed' | 'cancelled';

export interface ConfirmationModalState {
  booking: BusinessBookingItemDto;
  action: BookingConfirmationAction;
}

export interface ConfirmationModalProps {
  confirmation: ConfirmationModalState | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}
