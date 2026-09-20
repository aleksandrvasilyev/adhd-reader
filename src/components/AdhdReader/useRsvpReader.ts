import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReaderLanguage, ReaderLanguageOption, ReaderToken } from './types';
import { buildDelayPrefixSums, msPerWord, resolveTokenizeOptions, tokenize } from './utils';

export interface UseRsvpReaderOptions {
  /** Raw text to read. */
  text: string;
  /** Reading speed in words per minute. Changing it does not interrupt playback. */
  wpm: number;
  /** Language used for short-word merging. Defaults to `'auto'`. */
  language?: ReaderLanguageOption;
  /** Merge short prepositions/conjunctions with the next word. Defaults to `true`. */
  mergeShortWords?: boolean;
  /** Slow down on punctuation and paragraph breaks. Defaults to `true`. */
  punctuationPauses?: boolean;
  /** Start playing as soon as the text is (re)tokenized. Defaults to `false`. */
  autoPlay?: boolean;
  /** Called once when the last token has been displayed. */
  onFinish?: () => void;
  /** Called whenever the displayed token changes. */
  onIndexChange?: (index: number, total: number) => void;
}

export interface RsvpReaderApi {
  /** Every frame of the current text. */
  tokens: readonly ReaderToken[];
  /** Index of the token being displayed. */
  index: number;
  /** Token being displayed, or `null` when the text contains no words. */
  token: ReaderToken | null;
  isPlaying: boolean;
  /** True after the last token was shown (until play/seek/reset). */
  isFinished: boolean;
  /** Reading progress in the `0…1` range. */
  progress: number;
  /** Estimated duration of the whole text at the current WPM, in milliseconds. */
  totalMs: number;
  /** Estimated time left from the current token, in milliseconds. */
  remainingMs: number;
  /** Language actually used (resolved when `language` is `'auto'`). */
  language: ReaderLanguage;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  /** Jumps to a token index (clamped to the valid range). */
  seek: (index: number) => void;
  /** Moves by `delta` tokens relative to the current one. */
  step: (delta: number) => void;
}

/**
 * Headless RSVP engine: owns tokenization, the playback clock and all timing math.
 *
 * Each token is scheduled with its own `setTimeout` (base duration × the token's
 * multiplier), which is what turns a flat metronome into readable rhythm.
 */
export function useRsvpReader(options: UseRsvpReaderOptions): RsvpReaderApi {
  const {
    text,
    wpm,
    language = 'auto',
    mergeShortWords = true,
    punctuationPauses = true,
    autoPlay = false,
    onFinish,
    onIndexChange,
  } = options;

  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Callbacks and one-shot flags live in refs so that changing them never
  // restarts the playback timer.
  const onFinishRef = useRef(onFinish);
  const onIndexChangeRef = useRef(onIndexChange);
  const autoPlayRef = useRef(autoPlay);
  onFinishRef.current = onFinish;
  onIndexChangeRef.current = onIndexChange;
  autoPlayRef.current = autoPlay;

  const resolvedOptions = useMemo(
    () => resolveTokenizeOptions(text, { language, mergeShortWords, punctuationPauses }),
    [text, language, mergeShortWords, punctuationPauses],
  );

  const tokens = useMemo(() => tokenize(text, resolvedOptions), [text, resolvedOptions]);
  const prefixSums = useMemo(() => buildDelayPrefixSums(tokens), [tokens]);

  // New text (or new tokenizer settings) always starts from the beginning.
  useEffect(() => {
    setIndex(0);
    setIsFinished(false);
    setIsPlaying(autoPlayRef.current && tokens.length > 0);
  }, [tokens]);

  // The playback clock: one timeout per token, re-armed whenever the token,
  // the speed or the play state changes.
  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const token = tokens[index];
    if (token === undefined) {
      return;
    }

    const delay = msPerWord(wpm) * token.delayMultiplier;
    const timer = window.setTimeout(() => {
      if (index + 1 >= tokens.length) {
        setIsPlaying(false);
        setIsFinished(true);
        onFinishRef.current?.();
      } else {
        setIndex(index + 1);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [index, isPlaying, tokens, wpm]);

  useEffect(() => {
    onIndexChangeRef.current?.(index, tokens.length);
  }, [index, tokens.length]);

  const play = useCallback(() => {
    if (tokens.length === 0) {
      return;
    }
    // Pressing play on the very last token replays the text from the start.
    setIndex((previous) => (previous >= tokens.length - 1 ? 0 : previous));
    setIsFinished(false);
    setIsPlaying(true);
  }, [tokens.length]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setIsFinished(false);
    setIndex(0);
  }, []);

  const seek = useCallback(
    (nextIndex: number) => {
      if (tokens.length === 0) {
        return;
      }
      setIsFinished(false);
      setIndex(clamp(nextIndex, 0, tokens.length - 1));
    },
    [tokens.length],
  );

  const step = useCallback(
    (delta: number) => {
      if (tokens.length === 0) {
        return;
      }
      setIsFinished(false);
      setIndex((previous) => clamp(previous + delta, 0, tokens.length - 1));
    },
    [tokens.length],
  );

  const baseDuration = msPerWord(wpm);
  const totalWeight = prefixSums[tokens.length] ?? 0;
  const consumedWeight = prefixSums[Math.min(index, tokens.length)] ?? 0;

  return {
    tokens,
    index,
    token: tokens[index] ?? null,
    isPlaying,
    isFinished,
    progress: tokens.length === 0 ? 0 : isFinished ? 1 : (index + 1) / tokens.length,
    totalMs: totalWeight * baseDuration,
    remainingMs: isFinished ? 0 : (totalWeight - consumedWeight) * baseDuration,
    language: resolvedOptions.language,
    play,
    pause,
    toggle,
    reset,
    seek,
    step,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
