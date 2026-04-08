/**
 * Profanity filter for review moderation.
 * Stop-words list covers common Russian and Chechen profanity (basic level).
 * The filter is case-insensitive, handles word boundaries (Unicode-aware),
 * and replaces matched words with asterisks of the same length.
 *
 * NOTE: This is a basic moderation layer. It is intentionally conservative
 * (substitutes rather than rejects) to avoid blocking legitimate reviews
 * that may contain partial matches. Repeated reports + manual moderation
 * remain the source of truth for offensive content.
 */

// ─── Stop-words ───────────────────────────────────────────────────────────────
// Lowercased base forms (without prefixes/suffixes). Matched as substrings
// inside word boundaries to catch common conjugations.

const RU_STOP_WORDS: string[] = [
  // Russian — base profanity roots
  'хуй', 'хуе', 'хуё', 'хуи', 'хуя',
  'пизд',
  'ебал', 'ебат', 'ебан', 'ебуч', 'ебён', 'ёбан', 'ёбат',
  'бляд', 'блять',
  'сука', 'сук',
  'мудак', 'мудил', 'мудач',
  'гандон', 'гондон',
  'чмо',
  'долбоёб', 'долбоеб',
  'пидор', 'пидар', 'педик',
  'жопа', 'жоп',
  'хер', 'херн',
  'нахуй', 'похуй',
];

const CE_STOP_WORDS: string[] = [
  // Chechen — basic offensive vocabulary
  'дегIоьг', 'дегиоьг',
  'жIаьла', 'жиаьла',
  'хIунда', // marker root often used offensively
  'хIума',
  'нагахьа',
];

const ALL_STOP_WORDS: string[] = [...RU_STOP_WORDS, ...CE_STOP_WORDS].map((w) =>
  w.toLowerCase(),
);

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ProfanityCheckResult {
  /** Original input text */
  original: string;
  /** Cleaned text (offensive words replaced with asterisks of same length) */
  cleaned: string;
  /** True if at least one stop-word matched */
  hasProfanity: boolean;
  /** List of matched base stop-words (lowercased, deduplicated) */
  matches: string[];
}

/**
 * Check the input text for profanity. Returns a result object with the
 * sanitized version. Does not throw — caller decides what to do with the
 * result (substitute / reject / flag for moderation).
 */
export function checkProfanity(input: string | undefined | null): ProfanityCheckResult {
  const original = input ?? '';
  if (!original.trim()) {
    return { original, cleaned: original, hasProfanity: false, matches: [] };
  }

  const matchesSet = new Set<string>();
  let cleaned = original;

  for (const stop of ALL_STOP_WORDS) {
    // Build a unicode-aware regex matching the stop-word as a substring
    // surrounded by non-letters or string boundaries.
    // Using \p{L} requires the 'u' flag.
    const escaped = stop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\p{L}])([\\p{L}]*${escaped}[\\p{L}]*)(?![\\p{L}])`, 'giu');
    cleaned = cleaned.replace(re, (match) => {
      matchesSet.add(stop);
      return '*'.repeat(match.length);
    });
  }

  return {
    original,
    cleaned,
    hasProfanity: matchesSet.size > 0,
    matches: Array.from(matchesSet),
  };
}

/**
 * Convenience: returns the cleaned (censored) version of the text.
 */
export function censorText(input: string | undefined | null): string {
  return checkProfanity(input).cleaned;
}
