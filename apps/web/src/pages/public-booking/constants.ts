import { DayOption } from './types';

export const PUBLIC_BOOKING_DAYS_COUNT = 14;

function formatLocalDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const buildDays = (count: number): DayOption[] => {
  const days: DayOption[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const value = formatLocalDateValue(d);
    const label = d
      .toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
      .replace('.', '');
    days.push({ label, value });
  }
  return days;
};
