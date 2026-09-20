import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type JSX } from 'react';
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_WPM,
  MAX_FONT_SIZE,
  MAX_WPM,
  MIN_FONT_SIZE,
  MIN_WPM,
} from './constants';
import type { ReaderLanguageOption, ReaderTheme, ReaderToken } from './types';
import { useControllableState } from './useControllableState';
import { useRsvpReader } from './useRsvpReader';
import { formatDuration } from './utils';

export interface AdhdReaderLabels {
  play: string;
  pause: string;
  reset: string;
  previousWord: string;
  nextWord: string;
  speed: string;
  fontSize: string;
  lightTheme: string;
  darkTheme: string;
  /** e.g. `(3, 120) => "3 / 120"` */
  counter: (current: number, total: number) => string;
  /** e.g. `("1:23") => "1:23 left"` */
  remaining: (formatted: string) => string;
  /** Shown when there is nothing to read. */
  empty: string;
}

export const DEFAULT_LABELS: AdhdReaderLabels = {
  play: 'Play',
  pause: 'Pause',
  reset: 'Reset',
  previousWord: 'Previous word',
  nextWord: 'Next word',
  speed: 'Speed',
  fontSize: 'Font size',
  lightTheme: 'Light theme',
  darkTheme: 'Dark theme',
  counter: (current, total) => `${current} / ${total}`,
  remaining: (formatted) => `${formatted} left`,
  empty: 'Paste some text to start reading',
};

export interface AdhdReaderProps {
  /** Text to read. Changing it rewinds the reader to the first word. */
  text: string;
  /** Language for short-word merging. `'auto'` detects EN / RU / UK. Defaults to `'auto'`. */
  language?: ReaderLanguageOption;

  /** Controlled reading speed. Use together with `onWpmChange`. */
  wpm?: number;
  /** Initial speed when `wpm` is not controlled. Defaults to `300`. */
  defaultWpm?: number;
  onWpmChange?: (wpm: number) => void;

  /** Controlled font size in pixels. Use together with `onFontSizeChange`. */
  fontSize?: number;
  /** Initial font size when `fontSize` is not controlled. Defaults to `48`. */
  defaultFontSize?: number;
  onFontSizeChange?: (fontSize: number) => void;

  /** Controlled theme. Use together with `onThemeChange`. */
  theme?: ReaderTheme;
  /** Initial theme when `theme` is not controlled. Defaults to `'light'`. */
  defaultTheme?: ReaderTheme;
  onThemeChange?: (theme: ReaderTheme) => void;

  /** Glue short prepositions/conjunctions to the next word. Defaults to `true`. */
  mergeShortWords?: boolean;
  /** Pause longer on punctuation and paragraph breaks. Defaults to `true`. */
  punctuationPauses?: boolean;
  /** Start playing as soon as the text is loaded. Defaults to `false`. */
  autoPlay?: boolean;

  /** Render the built-in control panel. Defaults to `true`. */
  showControls?: boolean;
  /** Render the surrounding text with the current word highlighted. Defaults to `true`. */
  showContext?: boolean;
  /** Space = play/pause, R = reset, ← / → = step one word. Defaults to `true`. */
  enableKeyboardShortcuts?: boolean;

  /** Override any UI string (the defaults are English). */
  labels?: Partial<AdhdReaderLabels>;

  onFinish?: () => void;
  onIndexChange?: (index: number, total: number) => void;

  className?: string;
}

/** Imperative API exposed through `ref`, for driving the reader from outside. */
export interface AdhdReaderHandle {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  seek: (index: number) => void;
  /** Read-only snapshot of the current playback position. */
  getState: () => { index: number; total: number; isPlaying: boolean };
}

/**
 * RSVP reader: displays one word at a time in a fixed spot so the eyes never
 * have to move, with the Optimal Recognition Point pinned to the focus line.
 */
export const AdhdReader = forwardRef<AdhdReaderHandle, AdhdReaderProps>(function AdhdReader(
  {
    text,
    language = 'auto',
    wpm: controlledWpm,
    defaultWpm = DEFAULT_WPM,
    onWpmChange,
    fontSize: controlledFontSize,
    defaultFontSize = DEFAULT_FONT_SIZE,
    onFontSizeChange,
    theme: controlledTheme,
    defaultTheme = 'light',
    onThemeChange,
    mergeShortWords = true,
    punctuationPauses = true,
    autoPlay = false,
    showControls = true,
    showContext = true,
    enableKeyboardShortcuts = true,
    labels: labelOverrides,
    onFinish,
    onIndexChange,
    className,
  },
  ref,
) {
  const [wpm, setWpm] = useControllableState(controlledWpm, defaultWpm, onWpmChange);
  const [fontSize, setFontSize] = useControllableState(
    controlledFontSize,
    defaultFontSize,
    onFontSizeChange,
  );
  const [theme, setTheme] = useControllableState(controlledTheme, defaultTheme, onThemeChange);

  const labels = useMemo<AdhdReaderLabels>(
    () => ({ ...DEFAULT_LABELS, ...labelOverrides }),
    [labelOverrides],
  );

  const reader = useRsvpReader({
    text,
    wpm,
    language,
    mergeShortWords,
    punctuationPauses,
    autoPlay,
    onFinish,
    onIndexChange,
  });

  const { token, tokens, index, isPlaying, progress, remainingMs, play, pause, toggle, reset, seek, step } =
    reader;

  useImperativeHandle(
    ref,
    () => ({
      play,
      pause,
      toggle,
      reset,
      seek,
      getState: () => ({ index, total: tokens.length, isPlaying }),
    }),
    [play, pause, toggle, reset, seek, index, tokens.length, isPlaying],
  );

  // Keyboard shortcuts, ignored while the user is typing in a field.
  useEffect(() => {
    if (!enableKeyboardShortcuts) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
        return;
      }

      switch (event.key) {
        case ' ':
          event.preventDefault();
          toggle();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          step(-1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          step(1);
          break;
        case 'r':
        case 'R':
          event.preventDefault();
          reset();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, reset, step, toggle]);

  const isDark = theme === 'dark';

  return (
    <div className={cx('adhd-reader', isDark && 'dark', className)}>
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/5 sm:p-6 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
        <WordDisplay token={token} fontSize={fontSize} emptyLabel={labels.empty} />

        <div className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-label="Reading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          >
            <div
              className="h-full rounded-full bg-rose-500 transition-[width] duration-150 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs tabular-nums text-slate-500 dark:text-slate-400">
            <span>{labels.counter(tokens.length === 0 ? 0 : index + 1, tokens.length)}</span>
            <span>{labels.remaining(formatDuration(remainingMs))}</span>
          </div>
        </div>

        {showControls ? (
          <Controls
            labels={labels}
            isPlaying={isPlaying}
            disabled={tokens.length === 0}
            theme={theme}
            wpm={wpm}
            fontSize={fontSize}
            onToggle={toggle}
            onReset={reset}
            onStep={step}
            onWpmChange={setWpm}
            onFontSizeChange={setFontSize}
            onThemeChange={setTheme}
          />
        ) : null}

        {showContext ? <ContextPreview text={text} token={token} index={index} /> : null}
      </div>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/*                                  Internals                                  */
/* -------------------------------------------------------------------------- */

interface WordDisplayProps {
  token: ReaderToken | null;
  fontSize: number;
  emptyLabel: string;
}

/**
 * The focus area: three grid columns (`1fr auto 1fr`) keep the ORP character
 * exactly in the middle of the box no matter how long the word is, so the
 * highlighted letter always sits between the top and bottom focus ticks.
 */
function WordDisplay({ token, fontSize, emptyLabel }: WordDisplayProps): JSX.Element {
  const displayText = token?.text ?? '';
  const orpIndex = token?.orpIndex ?? 0;

  const before = displayText.slice(0, orpIndex);
  const orpChar = displayText.slice(orpIndex, orpIndex + 1);
  const after = displayText.slice(orpIndex + 1);

  return (
    <div className="relative select-none overflow-hidden rounded-2xl bg-slate-50 px-4 py-14 dark:bg-slate-950">
      {/* Focus guides: two rules with a tick pointing at the ORP character. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-6 top-10 h-px bg-slate-200 dark:bg-slate-800" />
        <div className="absolute left-1/2 top-10 h-4 w-0.5 -translate-x-1/2 rounded-full bg-rose-500/80" />
        <div className="absolute inset-x-6 bottom-10 h-px bg-slate-200 dark:bg-slate-800" />
        <div className="absolute bottom-10 left-1/2 h-4 w-0.5 -translate-x-1/2 rounded-full bg-rose-500/80" />
      </div>

      {token === null ? (
        <p className="relative text-center text-sm text-slate-400 dark:text-slate-500">
          {emptyLabel}
        </p>
      ) : (
        <p
          aria-hidden="true"
          className="relative grid grid-cols-[1fr_auto_1fr] items-baseline font-mono leading-none tracking-tight"
          style={{ fontSize: `${fontSize}px` }}
        >
          <span className="justify-self-end whitespace-pre text-slate-900 dark:text-slate-100">
            {before}
          </span>
          <span className="text-rose-600 dark:text-rose-400">{orpChar}</span>
          <span className="justify-self-start whitespace-pre text-slate-900 dark:text-slate-100">
            {after}
          </span>
        </p>
      )}

      {/* Screen readers get the plain word instead of the three fragments. */}
      <span className="sr-only">{displayText}</span>
    </div>
  );
}

interface ControlsProps {
  labels: AdhdReaderLabels;
  isPlaying: boolean;
  disabled: boolean;
  theme: ReaderTheme;
  wpm: number;
  fontSize: number;
  onToggle: () => void;
  onReset: () => void;
  onStep: (delta: number) => void;
  onWpmChange: (wpm: number) => void;
  onFontSizeChange: (fontSize: number) => void;
  onThemeChange: (theme: ReaderTheme) => void;
}

function Controls({
  labels,
  isPlaying,
  disabled,
  theme,
  wpm,
  fontSize,
  onToggle,
  onReset,
  onStep,
  onWpmChange,
  onFontSizeChange,
  onThemeChange,
}: ControlsProps): JSX.Element {
  const secondaryButton =
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={isPlaying ? labels.pause : labels.play}
          className="inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
          {isPlaying ? labels.pause : labels.play}
        </button>

        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          aria-label={labels.reset}
          className={secondaryButton}
        >
          <ResetIcon />
          {labels.reset}
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={disabled}
            aria-label={labels.previousWord}
            title={labels.previousWord}
            className={cx(secondaryButton, 'w-10 px-0')}
          >
            <StepIcon direction="backward" />
          </button>
          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={disabled}
            aria-label={labels.nextWord}
            title={labels.nextWord}
            className={cx(secondaryButton, 'w-10 px-0')}
          >
            <StepIcon direction="forward" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? labels.lightTheme : labels.darkTheme}
          title={theme === 'dark' ? labels.lightTheme : labels.darkTheme}
          className={cx(secondaryButton, 'ml-auto w-10 px-0')}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Slider
          label={labels.speed}
          value={wpm}
          min={MIN_WPM}
          max={MAX_WPM}
          step={10}
          suffix="WPM"
          onChange={onWpmChange}
        />
        <Slider
          label={labels.fontSize}
          value={fontSize}
          min={MIN_FONT_SIZE}
          max={MAX_FONT_SIZE}
          step={2}
          suffix="px"
          onChange={onFontSizeChange}
        />
      </div>
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, suffix, onChange }: SliderProps): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
        <span className="tabular-nums text-slate-900 dark:text-slate-100">
          {value} {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-rose-600 dark:bg-slate-700"
      />
    </label>
  );
}

interface ContextPreviewProps {
  text: string;
  token: ReaderToken | null;
  index: number;
}

/**
 * Shows the source text with the current token highlighted, so the reader keeps
 * a sense of place. The box scrolls itself (never the page) to follow along.
 */
function ContextPreview({ text, token, index }: ContextPreviewProps): JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const mark = markRef.current;
    if (container === null || mark === null) {
      return;
    }
    // Manual scrolling instead of scrollIntoView(): keeps the page itself still.
    const target = mark.offsetTop - container.clientHeight / 2 + mark.offsetHeight / 2;
    container.scrollTop = Math.max(0, target);
  }, [index]);

  if (token === null || text.trim().length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="relative max-h-40 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-600"
    >
      {text.slice(0, token.start)}
      <mark
        ref={markRef}
        className="rounded bg-rose-500/15 px-0.5 font-medium text-rose-600 dark:text-rose-400"
      >
        {text.slice(token.start, token.end)}
      </mark>
      {text.slice(token.end)}
    </div>
  );
}

/* --------------------------------- Icons --------------------------------- */

function PlayIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M5 3.5v9a.5.5 0 0 0 .77.42l7-4.5a.5.5 0 0 0 0-.84l-7-4.5A.5.5 0 0 0 5 3.5Z" />
    </svg>
  );
}

function PauseIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M5 3h2v10H5V3Zm4 0h2v10H9V3Z" />
    </svg>
  );
}

function ResetIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8a5 5 0 1 0 1.6-3.7" />
      <path d="M3 3v3h3" />
    </svg>
  );
}

function StepIcon({ direction }: { direction: 'forward' | 'backward' }): JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cx('h-4 w-4 fill-current', direction === 'backward' && 'rotate-180')}
    >
      <path d="M4 3.5v9a.5.5 0 0 0 .78.42L10 9.4V12a.5.5 0 0 0 1 0V4a.5.5 0 0 0-1 0v2.6L4.78 3.08A.5.5 0 0 0 4 3.5Z" />
    </svg>
  );
}

function SunIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M13 3l-1 1M4 12l-1 1" />
    </svg>
  );
}

function MoonIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M13.5 10.2A5.8 5.8 0 0 1 5.8 2.5a5.8 5.8 0 1 0 7.7 7.7Z" />
    </svg>
  );
}

/* -------------------------------- Helpers -------------------------------- */

/** Minimal `classnames` replacement so the component stays dependency-free. */
function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** True when a keyboard event came from a field the user is typing in. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export default AdhdReader;
export {
  DEFAULT_FONT_SIZE,
  DEFAULT_WPM,
  MAX_FONT_SIZE,
  MAX_WPM,
  MIN_FONT_SIZE,
  MIN_WPM,
  SHORT_WORDS,
} from './constants';
export { useRsvpReader } from './useRsvpReader';
export type { RsvpReaderApi, UseRsvpReaderOptions } from './useRsvpReader';
export * from './types';
export {
  computeOrpIndex,
  detectLanguage,
  formatDuration,
  getPunctuationFactor,
  tokenize,
} from './utils';
