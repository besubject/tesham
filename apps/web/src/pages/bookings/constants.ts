import { TStatus } from 'src/types';
import { TBookingsPeriod } from './types';

export const STATUS_TABS: Array<{ value: TStatus; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'confirmed', label: 'Подтверждены' },
  { value: 'completed', label: 'Завершены' },
  { value: 'cancelled', label: 'Отменены' },
];

export const PERIOD_TABS: Array<{ value: TBookingsPeriod; label: string }> = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
];

export const BOOKINGS_PAGE_SIZE_OPTIONS = [
  { value: '10', label: 'По 10' },
  { value: '20', label: 'По 20' },
  { value: '50', label: 'По 50' },
];
