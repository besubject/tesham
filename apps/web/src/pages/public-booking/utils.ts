import { StaffMember } from './types';

export const getPhoneDigits = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('7') ? digits.slice(1) : digits;
};

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
};

export const formatPrice = (price: number): string => `${price.toLocaleString('ru-RU')} ₽`;

export const findStaffBySlug = (staff: StaffMember[], staffSlug: string): StaffMember | null => {
  const byId = staff.find((s) => s.id === staffSlug);
  if (byId) return byId;
  const normalized = staffSlug.toLowerCase();
  return staff.find((s) => s.name.toLowerCase().replace(/\s+/g, '-') === normalized) ?? null;
};

export const setOgTags = (title: string, description: string, image: string | null): void => {
  document.title = title;
  const setMeta = (property: string, content: string) => {
    let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMeta('og:title', title);
  setMeta('og:description', description);
  setMeta('og:type', 'website');
  if (image) setMeta('og:image', image);
};
