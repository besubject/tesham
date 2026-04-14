import { StatsPeriod } from './types';

export const STATS_PERIOD_TABS: Array<{ value: StatsPeriod; label: string }> = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
];

export const STATS_COPY = {
  title: 'Статистика',
  subtitle: 'Анализ деятельности вашего бизнеса',
  loading: 'Загрузка...',
  empty: 'Нет данных',
  bookings: 'Записи',
  rating: 'Средняя оценка',
  showRate: 'Явка клиентов',
  showRateHint: 'С учетом отмен и случаев, когда клиент не пришел',
  sourcesTitle: 'Источники записей',
  sourceApp: 'Мобильное приложение',
  sourceWalkIn: 'Приём без записи',
  byStaffTitle: 'Статистика по мастерам',
  byStaffName: 'Мастер',
  byStaffBookings: 'Записи',
  byStaffShowRate: 'Явка (с учетом отмен и случаев, когда клиент не пришел)',
} as const;
