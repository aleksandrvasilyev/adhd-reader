/**
 * Shared types for the ADHD Reader (RSVP) component.
 */

/** Languages the tokenizer knows how to handle. `uk` is the ISO 639-1 code for Ukrainian. */
export type ReaderLanguage = 'en' | 'ru' | 'uk';

/** Language prop value: an explicit language or automatic detection from the text itself. */
export type ReaderLanguageOption = ReaderLanguage | 'auto';

export type ReaderTheme = 'light' | 'dark';

/** What kind of whitespace follows a word in the source text. */
export type BreakKind = 'none' | 'line' | 'paragraph';

/**
 * A single RSVP "frame": exactly what is painted in the center of the screen,
 * for how long, and which character has to sit on the focus point.
 */
export interface ReaderToken {
  /** Text to display. May contain a space when short words were merged ("in the"). */
  readonly text: string;
  /** Index (inside `text`) of the Optimal Recognition Point character. */
  readonly orpIndex: number;
  /** Display time relative to the base word duration (60000 / wpm milliseconds). */
  readonly delayMultiplier: number;
  /** Offset of the first character of the token inside the original text. */
  readonly start: number;
  /** Offset just past the last character of the token inside the original text. */
  readonly end: number;
  /** How many source words this token represents (> 1 when merged). */
  readonly wordCount: number;
  /** True when the token ends with `.`, `!`, `?` or `…`. */
  readonly endsSentence: boolean;
  /** True when a paragraph break (or the end of the text) follows the token. */
  readonly endsParagraph: boolean;
}

export interface TokenizeOptions {
  /** Language used for the short-word list. Defaults to `'auto'`. */
  language?: ReaderLanguageOption;
  /** Merge short prepositions/conjunctions with the next word. Defaults to `true`. */
  mergeShortWords?: boolean;
  /** Add extra delay after punctuation and paragraph breaks. Defaults to `true`. */
  punctuationPauses?: boolean;
  /** Maximum character length of a merged token. Defaults to `14`. */
  maxMergedLength?: number;
  /** Maximum number of source words inside one merged token. Defaults to `3`. */
  maxMergedWords?: number;
}

/** `TokenizeOptions` after defaults have been applied. */
export interface ResolvedTokenizeOptions {
  language: ReaderLanguage;
  mergeShortWords: boolean;
  punctuationPauses: boolean;
  maxMergedLength: number;
  maxMergedWords: number;
}
