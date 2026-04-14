import { DayOption } from './types';

export const PUBLIC_BOOKING_DAYS_COUNT = 14;

export const buildDays = (count: number): DayOption[] => {
  const days: DayOption[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const value = d.toISOString().slice(0, 10);
    const label = d
      .toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
      .replace('.', '');
    days.push({ label, value });
  }
  return days;
};
