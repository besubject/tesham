import { UserLanguage } from '@mettig/shared';

export const PROFILE_LANGUAGE_OPTIONS: Array<{ value: UserLanguage; label: string }> = [
  { value: 'ru', label: 'Русский' },
  { value: 'ce', label: 'Чеченский' },
];

export const PROFILE_MESSAGES = {
  emptyName: 'Введите имя',
  updateError: 'Не удалось обновить профиль',
  updateSuccess: 'Профиль обновлен',
  logoutError: 'Не удалось выйти',
  deleteError: 'Не удалось удалить аккаунт',
} as const;
