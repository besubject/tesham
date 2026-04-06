import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './ru.json';
import ce from './ce.json';

export const defaultNS = 'translation';

export const resources = {
  ru: { translation: ru },
  ce: { translation: ce },
} as const;

export function initI18n(language: 'ru' | 'ce' = 'ru'): typeof i18n {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng: language,
      fallbackLng: 'ru',
      defaultNS,
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    });
  }
  return i18n;
}

export { i18n };
export { useTranslation } from 'react-i18next';
