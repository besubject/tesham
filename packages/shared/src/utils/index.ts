/**
 * Format Russian phone number to "+7 (XXX) XXX-XX-XX"
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('8') ? '7' + digits.slice(1) : digits;
  if (normalized.length !== 11) return phone;
  return `+${normalized[0]} (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`;
}

/**
 * Format date string (YYYY-MM-DD or ISO) to Russian locale string
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ru-RU', options ?? { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Format time string "HH:MM"
 */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

/**
 * Format price to "X ₽"
 */
export function formatPrice(price: number): string {
  return `${price.toLocaleString('ru-RU')} ₽`;
}

/**
 * Get initials from full name
 * "Ахмед Кадыров" → "АК"
 * "Ахмед" → "А"
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase();
  return ((parts[0][0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Anonymize full name: "Ахмед Кадыров" → "Ахмед К."
 */
export function anonymizeName(name: string): string {
  if (!name.trim()) return 'Пользователь';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0] ?? name;
  return `${parts[0]} ${parts[1]?.[0] ?? ''}.`;
}

/**
 * Calculate distance text
 */
export function formatDistance(meters: number | null): string {
  if (meters === null) return '';
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}
