import { Step } from './types';

export const VALID_PHONE_LENGTH = 10;
export const VALID_CODE_LENGTH = 6;

export const LOGIN_PAGE_COPY = {
  invalidPhone: 'Введите корректный номер телефона',
  sendCodeError: 'Не удалось отправить код. Попробуйте снова.',
  invalidCode: 'Введите 6-значный код',
  verifyWithEmail: 'Для этого аккаунта нужен вход через подтверждение email.',
  verifyCodeError: 'Неверный код. Попробуйте снова.',
  title: 'Tesham Business',
  subtitle: 'Вход в кабинет мастера',
  phoneLabel: 'Номер телефона',
  phonePlaceholder: '+7 (___) ___-__-__',
  codeTitle: 'Код подтверждения',
  backToPhone: 'Вернуться к номеру телефона',
  staffCabinet: 'Это кабинет для мастеров и администраторов',
  clientHint: 'Для клиентов используйте мобильное приложение',
} as const;

export const LOGIN_STEP_ACTION_LABELS: Record<Step, string> = {
  phone: 'Отправить код',
  code: 'Подтвердить',
};
