const CYRILLIC_TO_LATIN_SINGLE = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'j',
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
  х: 'h',
  ц: 'c',
  ч: 'c',
  ш: 's',
  щ: 'q',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'u',
  я: 'a',
  ӏ: '',
} as const;

const LATIN_TO_CYRILLIC_KEYBOARD = {
  q: 'й',
  w: 'ц',
  e: 'у',
  r: 'к',
  t: 'е',
  y: 'н',
  u: 'г',
  i: 'ш',
  o: 'щ',
  p: 'з',
  '[': 'х',
  ']': 'ъ',
  a: 'ф',
  s: 'ы',
  d: 'в',
  f: 'а',
  g: 'п',
  h: 'р',
  j: 'о',
  k: 'л',
  l: 'д',
  ';': 'ж',
  "'": 'э',
  z: 'я',
  x: 'ч',
  c: 'с',
  v: 'м',
  b: 'и',
  n: 'т',
  m: 'ь',
  ',': 'б',
  '.': 'ю',
  '/': '.',
} as const;

const CYRILLIC_TO_LATIN_KEYBOARD = Object.fromEntries(
  Object.entries(LATIN_TO_CYRILLIC_KEYBOARD).map(([latin, cyrillic]) => [cyrillic, latin]),
) as Record<string, string>;

export const SQL_CYRILLIC_SEARCH_CHARS = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяӏ';
export const SQL_LATIN_SEARCH_CHARS = 'abvgdeejziyklmnoprstufhccsqyyeua';

export interface SearchTokenVariant {
  rawVariants: string[];
  latinVariants: string[];
}

export interface SearchQueryVariant {
  rawVariants: string[];
  latinVariants: string[];
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function remapKeyboardLayout(value: string): string {
  return value
    .split('')
    .map((char) => {
      const lower = char.toLowerCase();
      return LATIN_TO_CYRILLIC_KEYBOARD[lower as keyof typeof LATIN_TO_CYRILLIC_KEYBOARD]
        ?? CYRILLIC_TO_LATIN_KEYBOARD[lower]
        ?? lower;
    })
    .join('');
}

function transliterateToLatinSingle(value: string): string {
  return value
    .split('')
    .map((char) => CYRILLIC_TO_LATIN_SINGLE[char as keyof typeof CYRILLIC_TO_LATIN_SINGLE] ?? char)
    .join('');
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeQuery(value)).filter(Boolean)));
}

export function buildSearchTokenVariants(query: string): SearchTokenVariant[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  return normalized.split(' ').map((token) => {
    const remapped = remapKeyboardLayout(token);
    const rawVariants = uniqueNonEmpty([token, remapped]);
    const latinVariants = uniqueNonEmpty([
      token,
      remapped,
      transliterateToLatinSingle(token),
      transliterateToLatinSingle(remapped),
    ]);

    return {
      rawVariants,
      latinVariants,
    };
  });
}

export function buildSearchQueryVariants(query: string): SearchQueryVariant {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return { rawVariants: [], latinVariants: [] };
  }

  const remapped = remapKeyboardLayout(normalized);

  return {
    rawVariants: uniqueNonEmpty([normalized, remapped]),
    latinVariants: uniqueNonEmpty([
      normalized,
      remapped,
      transliterateToLatinSingle(normalized),
      transliterateToLatinSingle(remapped),
    ]),
  };
}
