import type { ReaderLanguage } from './types';

/**
 * Function words that are too short to deserve their own RSVP frame.
 *
 * Showing "в", "з" or "the" alone for a full frame makes the reader flicker and
 * wastes attention, so these words are glued to the word that follows them
 * (see `tokenize()` in `utils.ts`).
 *
 * The lists intentionally contain only articles, prepositions, conjunctions,
 * particles and very short pronouns — merging content words would hurt reading.
 */
export const SHORT_WORDS: Readonly<Record<ReaderLanguage, ReadonlySet<string>>> = {
  en: new Set([
    // articles
    'a', 'an', 'the',
    // conjunctions
    'and', 'or', 'but', 'nor', 'so', 'yet', 'if', 'as', 'than', 'then', 'that',
    // prepositions
    'of', 'to', 'in', 'on', 'at', 'by', 'up', 'for', 'off', 'out', 'per', 'via',
    'with', 'from', 'into', 'onto', 'over', 'upon',
    // auxiliaries / negation
    'is', 'am', 'are', 'was', 'be', 'do', 'did', 'has', 'had', 'no', 'not',
    // short pronouns
    'i', 'it', 'its', 'he', 'we', 'my', 'me', 'us', 'you', 'his', 'her',
    'this', 'they', 'our',
  ]),
  ru: new Set([
    // prepositions
    'в', 'во', 'на', 'за', 'к', 'ко', 'с', 'со', 'у', 'о', 'об', 'обо', 'от',
    'до', 'из', 'изо', 'по', 'при', 'над', 'под', 'про', 'без', 'для', 'ради',
    // conjunctions and particles
    'и', 'а', 'но', 'да', 'же', 'ли', 'бы', 'не', 'ни', 'то', 'как', 'что',
    'чем', 'уж', 'вот', 'так', 'или', 'ведь', 'лишь', 'даже', 'если',
    // short pronouns / determiners
    'я', 'ты', 'он', 'мы', 'вы', 'их', 'её', 'ее', 'его', 'мой', 'моя', 'наш',
    'это', 'эта', 'эти', 'тот', 'та', 'те', 'все', 'вся', 'кто', 'где',
  ]),
  uk: new Set([
    // prepositions
    'в', 'у', 'на', 'за', 'до', 'з', 'із', 'зі', 'зо', 'к', 'о', 'об', 'від',
    'під', 'над', 'про', 'без', 'для', 'при', 'по', 'біля', 'коло',
    // conjunctions and particles
    'і', 'й', 'та', 'а', 'але', 'чи', 'що', 'як', 'не', 'ні', 'же', 'ж', 'би',
    'б', 'бо', 'то', 'аби', 'хоч', 'лише', 'вже', 'ще', 'так', 'ось',
    // short pronouns / determiners
    'я', 'ти', 'ми', 'ви', 'він', 'їх', 'її', 'його', 'мій', 'моя', 'наш',
    'це', 'цей', 'ця', 'той', 'ті', 'та', 'хто', 'де',
  ]),
};

/** A word longer than this is never treated as a mergeable "short" word. */
export const MAX_SHORT_WORD_LENGTH = 4;

/** Default upper bound for the rendered length of a merged token. */
export const DEFAULT_MAX_MERGED_LENGTH = 14;

/** Default upper bound for how many source words end up in one merged token. */
export const DEFAULT_MAX_MERGED_WORDS = 3;

/**
 * Relative delay added by trailing punctuation, expressed as a multiplier of
 * the base word duration. Tuned so that sentences breathe without stalling.
 */
export const PAUSE_FACTORS = {
  /** `.` `!` `?` `…` — end of a thought. */
  sentence: 2.4,
  /** `:` `;` `—` `–` — strong clause separator. */
  clause: 1.8,
  /** `,` — light clause separator. */
  comma: 1.5,
  /** `»` `”` `"` `)` `]` without any other mark — closing a quote or bracket. */
  closing: 1.2,
  /** No trailing punctuation at all. */
  none: 1,
} as const;

/** Extra delay for a blank line / single line break between words. */
export const BREAK_FACTORS: Record<'paragraph' | 'line' | 'none', number> = {
  paragraph: 1.6,
  line: 1.15,
  none: 1,
};

/** Words longer than this get a little extra time, `LENGTH_BONUS` per character. */
export const LONG_WORD_THRESHOLD = 8;
export const LENGTH_BONUS_PER_CHAR = 0.04;
export const MAX_LENGTH_FACTOR = 1.6;

/** Each extra word merged into a token adds this much display time. */
export const MERGE_BONUS_PER_WORD = 0.15;

/** WPM slider bounds required by the spec. */
export const MIN_WPM = 100;
export const MAX_WPM = 900;
export const DEFAULT_WPM = 300;

/** Font size slider bounds (pixels). */
export const MIN_FONT_SIZE = 24;
export const MAX_FONT_SIZE = 88;
export const DEFAULT_FONT_SIZE = 48;
