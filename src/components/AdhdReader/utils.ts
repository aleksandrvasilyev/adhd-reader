import {
  BREAK_FACTORS,
  DEFAULT_MAX_MERGED_LENGTH,
  DEFAULT_MAX_MERGED_WORDS,
  LENGTH_BONUS_PER_CHAR,
  LONG_WORD_THRESHOLD,
  MAX_LENGTH_FACTOR,
  MAX_SHORT_WORD_LENGTH,
  MERGE_BONUS_PER_WORD,
  PAUSE_FACTORS,
  SHORT_WORDS,
} from './constants';
import type {
  BreakKind,
  ReaderLanguage,
  ReaderToken,
  ResolvedTokenizeOptions,
  TokenizeOptions,
} from './types';

/** Anything that is not a letter or a digit counts as punctuation/decoration. */
const LEADING_PUNCTUATION = /^[^\p{L}\p{N}]+/u;
const TRAILING_PUNCTUATION = /[^\p{L}\p{N}]+$/u;
const SENTENCE_MARKS = /[.!?…]/u;
const CLAUSE_MARKS = /[:;—–]/u;
const CLOSING_MARKS = /[»”"')\]}]/u;

/** A word split into decoration + letters + decoration, e.g. `«дом»,` → `«` + `дом` + `»,`. */
export interface WordAffixes {
  leading: string;
  core: string;
  trailing: string;
}

/**
 * Splits leading and trailing punctuation off a word.
 * Inner punctuation is preserved: `don't` and `будь-ласка` stay intact.
 */
export function splitAffixes(word: string): WordAffixes {
  const leading = word.match(LEADING_PUNCTUATION)?.[0] ?? '';
  const rest = word.slice(leading.length);
  const trailing = rest.match(TRAILING_PUNCTUATION)?.[0] ?? '';
  const core = rest.slice(0, rest.length - trailing.length);
  return { leading, core, trailing };
}

/**
 * Detects the language of a text by counting alphabet-specific characters.
 *
 * Ukrainian is identified by `і ї є ґ`, Russian by `ы э ъ ё`; everything that is
 * mostly Latin falls back to English.
 */
export function detectLanguage(text: string): ReaderLanguage {
  const latin = text.match(/[a-z]/giu)?.length ?? 0;
  const cyrillic = text.match(/[\u0400-\u04ff]/gu)?.length ?? 0;

  if (cyrillic === 0 || latin > cyrillic) {
    return 'en';
  }

  const ukrainianMarkers = text.match(/[іїєґ]/giu)?.length ?? 0;
  const russianMarkers = text.match(/[ыэъё]/giu)?.length ?? 0;

  return ukrainianMarkers > russianMarkers ? 'uk' : 'ru';
}

/**
 * Optimal Recognition Point — the character the eye should land on.
 *
 * The eye does not fixate on the middle of a word but slightly left of it, so
 * the ORP grows in steps with the word length instead of being `length / 2`.
 * Leading punctuation (`«`, `(`, …) is skipped: it must not shift the anchor.
 *
 * @returns index of the ORP character inside `word`.
 */
export function computeOrpIndex(word: string): number {
  const { leading, core } = splitAffixes(word);

  // Pure punctuation (a lone dash, for example): just centre it.
  if (core.length === 0) {
    return Math.max(0, Math.floor((word.length - 1) / 2));
  }

  let offset: number;
  if (core.length <= 1) {
    offset = 0;
  } else if (core.length <= 5) {
    offset = 1;
  } else if (core.length <= 9) {
    offset = 2;
  } else if (core.length <= 13) {
    offset = 3;
  } else {
    offset = 4;
  }

  return Math.min(leading.length + offset, word.length - 1);
}

/**
 * The marks that close a word and therefore create a pause. An opening quote
 * must not slow anything down, but a word made only of punctuation (a lone
 * `—`, for instance) counts entirely as a closing mark.
 */
function getClosingMarks(word: string): string {
  const { leading, core, trailing } = splitAffixes(word);
  return core.length === 0 ? leading : trailing;
}

/**
 * Delay multiplier contributed by the punctuation that closes a word.
 */
export function getPunctuationFactor(word: string): number {
  const trailing = getClosingMarks(word);
  if (trailing.length === 0) {
    return PAUSE_FACTORS.none;
  }
  if (SENTENCE_MARKS.test(trailing)) {
    return PAUSE_FACTORS.sentence;
  }
  if (CLAUSE_MARKS.test(trailing)) {
    return PAUSE_FACTORS.clause;
  }
  if (trailing.includes(',')) {
    return PAUSE_FACTORS.comma;
  }
  if (CLOSING_MARKS.test(trailing)) {
    return PAUSE_FACTORS.closing;
  }
  return PAUSE_FACTORS.none;
}

/** Long words need more time than short ones, capped so reading never stalls. */
export function getLengthFactor(coreLength: number): number {
  const bonus = Math.max(0, coreLength - LONG_WORD_THRESHOLD) * LENGTH_BONUS_PER_CHAR;
  return Math.min(1 + bonus, MAX_LENGTH_FACTOR);
}

/** True when the word is a short function word that should be glued to the next one. */
export function isMergeableShortWord(word: string, language: ReaderLanguage): boolean {
  const { core, trailing } = splitAffixes(word);

  // Punctuation after the word means a pause belongs there — never merge across it.
  if (core.length === 0 || trailing.length > 0) {
    return false;
  }
  if (core.length > MAX_SHORT_WORD_LENGTH) {
    return false;
  }

  return SHORT_WORDS[language].has(core.toLowerCase());
}

/**
 * True for whitespace-separated tokens that are only punctuation (`—`, `…`, `«»`).
 * Showing them alone as an RSVP frame looks broken, so they are glued to a neighbour.
 */
export function isPunctuationOnly(word: string): boolean {
  return word.length > 0 && splitAffixes(word).core.length === 0;
}

/** A whitespace-separated word plus its position in the source text. */
interface RawWord {
  raw: string;
  start: number;
  end: number;
  /** Whitespace that follows this word, classified as line/paragraph break. */
  breakAfter: BreakKind;
}

/** Splits the text on whitespace while remembering source offsets and breaks. */
function splitRawWords(text: string): RawWord[] {
  const pattern = /\S+/gu;
  const words: RawWord[] = [];
  let previous: RawWord | null = null;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const raw = match[0];
    const word: RawWord = {
      raw,
      start: match.index,
      end: match.index + raw.length,
      breakAfter: 'none',
    };

    if (previous !== null) {
      previous.breakAfter = classifyGap(text.slice(previous.end, word.start));
    }

    words.push(word);
    previous = word;
  }

  // The end of the text behaves like the end of a paragraph.
  if (previous !== null) {
    previous.breakAfter = 'paragraph';
  }

  return words;
}

/** Two or more newlines separate paragraphs, a single one is just a line break. */
function classifyGap(gap: string): BreakKind {
  const newlines = gap.match(/\n/g)?.length ?? 0;
  if (newlines >= 2) {
    return 'paragraph';
  }
  return newlines === 1 ? 'line' : 'none';
}

/** Builds one RSVP frame out of one or more consecutive source words. */
function createToken(group: RawWord[], options: ResolvedTokenizeOptions): ReaderToken {
  const first = group[0] as RawWord;
  const last = group[group.length - 1] as RawWord;
  const text = group.map((word) => word.raw).join(' ');

  // The ORP is placed inside the longest word of the group: in "in the house"
  // the eye must land on "house", not on the glued preposition.
  let anchorIndex = 0;
  let anchorOffset = 0;
  let anchorCoreLength = -1;
  let offset = 0;

  group.forEach((word, index) => {
    const coreLength = splitAffixes(word.raw).core.length;
    if (coreLength >= anchorCoreLength) {
      anchorCoreLength = coreLength;
      anchorIndex = index;
      anchorOffset = offset;
    }
    offset += word.raw.length + 1; // +1 for the joining space
  });

  const anchor = group[anchorIndex] as RawWord;
  const orpIndex = Math.min(anchorOffset + computeOrpIndex(anchor.raw), text.length - 1);

  const punctuationFactor = options.punctuationPauses ? getGroupPunctuationFactor(group) : 1;
  const breakFactor = options.punctuationPauses ? BREAK_FACTORS[last.breakAfter] : 1;
  const lengthFactor = getLengthFactor(Math.max(anchorCoreLength, 0));
  // Punctuation-only tokens (`—`) do not count as "extra words" for the merge bonus.
  const contentWords = group.filter((word) => !isPunctuationOnly(word.raw)).length;
  const mergeFactor = 1 + Math.max(0, contentWords - 1) * MERGE_BONUS_PER_WORD;

  return {
    text,
    orpIndex: Math.max(0, orpIndex),
    delayMultiplier: roundTo(punctuationFactor * breakFactor * lengthFactor * mergeFactor, 3),
    start: first.start,
    end: last.end,
    wordCount: Math.max(1, contentWords),
    endsSentence: group.some((word) => SENTENCE_MARKS.test(getClosingMarks(word.raw))),
    endsParagraph: last.breakAfter === 'paragraph',
  };
}

/**
 * Strongest pause contributed by any member of the group.
 * Needed when a lone `—` is glued before the next word (`— советуют`): the pause
 * lives on the dash, not on the trailing content word.
 */
function getGroupPunctuationFactor(group: readonly RawWord[]): number {
  let max: number = PAUSE_FACTORS.none;
  for (const word of group) {
    max = Math.max(max, getPunctuationFactor(word.raw));
  }
  return max;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Fills in the defaults and resolves `'auto'` to a concrete language. */
export function resolveTokenizeOptions(
  text: string,
  options: TokenizeOptions = {},
): ResolvedTokenizeOptions {
  const language = options.language ?? 'auto';
  return {
    language: language === 'auto' ? detectLanguage(text) : language,
    mergeShortWords: options.mergeShortWords ?? true,
    punctuationPauses: options.punctuationPauses ?? true,
    maxMergedLength: options.maxMergedLength ?? DEFAULT_MAX_MERGED_LENGTH,
    maxMergedWords: options.maxMergedWords ?? DEFAULT_MAX_MERGED_WORDS,
  };
}

/**
 * Turns raw text into the sequence of frames the reader displays.
 *
 * Short function words are merged forward ("in the house", "в доме", "з книгою"),
 * lone punctuation like `—` is glued to a neighbour so it never flashes alone,
 * and every token carries its own delay multiplier so punctuation creates a
 * natural rhythm instead of a metronome.
 */
export function tokenize(text: string, options: TokenizeOptions = {}): ReaderToken[] {
  const resolved = resolveTokenizeOptions(text, options);
  const words = splitRawWords(text);
  const tokens: ReaderToken[] = [];

  let index = 0;
  while (index < words.length) {
    const group: RawWord[] = [words[index] as RawWord];

    if (resolved.mergeShortWords) {
      // Keep gluing while the last word of the group is a short function word:
      // "in" → "in the" → "in the house".
      while (group.length < resolved.maxMergedWords) {
        const current = group[group.length - 1] as RawWord;
        const next = words[index + group.length];

        if (next === undefined || current.breakAfter !== 'none') {
          break;
        }
        if (!isMergeableShortWord(current.raw, resolved.language)) {
          break;
        }

        // Rendered length = characters + one space per join.
        const projectedLength =
          group.reduce((sum, word) => sum + word.raw.length, 0) + group.length + next.raw.length;
        if (projectedLength > resolved.maxMergedLength) {
          break;
        }

        group.push(next);
      }
    }

    // Space-separated dashes (`предъявление —`) must not become their own frame.
    absorbTrailingPunctuation(group, words, index);
    // Leading dash with no previous word (`— Hello`) sticks to the next one.
    absorbLeadingPunctuation(group, words, index);

    tokens.push(createToken(group, resolved));
    index += group.length;
  }

  return tokens;
}

/** Append every following punctuation-only token (`—`, `…`) onto the current group. */
function absorbTrailingPunctuation(
  group: RawWord[],
  words: readonly RawWord[],
  groupStart: number,
): void {
  while (true) {
    const current = group[group.length - 1] as RawWord;
    const next = words[groupStart + group.length];

    if (next === undefined || current.breakAfter !== 'none') {
      return;
    }
    if (!isPunctuationOnly(next.raw)) {
      return;
    }

    group.push(next);
  }
}

/**
 * If the group is only punctuation, pull the next content word in so the dash
 * never stands alone at the start of a sentence or after a paragraph break.
 */
function absorbLeadingPunctuation(
  group: RawWord[],
  words: readonly RawWord[],
  groupStart: number,
): void {
  if (!group.every((word) => isPunctuationOnly(word.raw))) {
    return;
  }

  const last = group[group.length - 1] as RawWord;
  const next = words[groupStart + group.length];

  if (next === undefined || last.breakAfter !== 'none') {
    return;
  }

  group.push(next);
  absorbTrailingPunctuation(group, words, groupStart);
}

/**
 * Running sum of delay multipliers: `prefix[i]` is the cost of tokens `0…i-1`.
 * Used to estimate total and remaining reading time in O(1).
 */
export function buildDelayPrefixSums(tokens: readonly ReaderToken[]): number[] {
  const prefix = new Array<number>(tokens.length + 1);
  prefix[0] = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    prefix[i + 1] = (prefix[i] as number) + (tokens[i] as ReaderToken).delayMultiplier;
  }
  return prefix;
}

/** Base duration of one word in milliseconds. */
export function msPerWord(wpm: number): number {
  return 60_000 / Math.max(1, wpm);
}

/** `93000` → `"1:33"`. */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
