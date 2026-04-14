// ─── Transliterate ────────────────────────────────────────────────────────────
// Converts a Russian/Chechen name to a URL-safe slug (a-z, 0-9, hyphen).

const CHAR_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  // Chechen-specific
  ӏ: '',
  ӀI: '',
  ӀI2: '',
};

/**
 * Converts a business name to a URL-safe slug.
 * Example: 'Барбершоп Султан' → 'barbershop-sultan'
 */
export function transliterate(name: string): string {
  let result = name
    .toLowerCase()
    // Map Cyrillic chars
    .split('')
    .map((ch) => CHAR_MAP[ch] ?? ch)
    .join('');

  // Replace any non-alphanumeric (except already-latin letters and digits) with hyphen
  result = result.replace(/[^a-z0-9]+/g, '-');

  // Trim leading/trailing hyphens and collapse consecutive hyphens
  result = result.replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');

  return result;
}
