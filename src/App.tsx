import { useMemo, useState, type JSX, type ReactNode } from 'react';
import {
  AdhdReader,
  DEFAULT_FONT_SIZE,
  DEFAULT_WPM,
  tokenize,
  type ReaderLanguageOption,
  type ReaderTheme,
} from './components/AdhdReader';
import { SAMPLE_TEXTS, type SampleText } from './samples';

/** Which text the demo is currently showing: one of the samples, or the user's own. */
type SourceId = SampleText['id'] | 'custom';

const LANGUAGE_OPTIONS: ReadonlyArray<{ value: ReaderLanguageOption; label: string }> = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
];

export default function App(): JSX.Element {
  const [sourceId, setSourceId] = useState<SourceId>('demo');
  const [customText, setCustomText] = useState('');
  const [language, setLanguage] = useState<ReaderLanguageOption>('auto');
  const [wpm, setWpm] = useState(DEFAULT_WPM);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [theme, setTheme] = useState<ReaderTheme>('light');
  const [mergeShortWords, setMergeShortWords] = useState(true);
  const [punctuationPauses, setPunctuationPauses] = useState(true);

  const text =
    sourceId === 'custom'
      ? customText
      : (SAMPLE_TEXTS.find((sample) => sample.id === sourceId)?.text ?? '');

  // Editing a sample silently turns it into the user's own text.
  const handleTextChange = (value: string): void => {
    setCustomText(value);
    if (sourceId !== 'custom') {
      setSourceId('custom');
    }
  };

  // Word count vs. frame count shows how much flicker the merging removes.
  const stats = useMemo(() => {
    const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/u).length;
    const frames = tokenize(text, { language, mergeShortWords, punctuationPauses }).length;
    return { words, frames };
  }, [text, language, mergeShortWords, punctuationPauses]);

  return (
    <div className={theme === 'dark' ? 'dark' : undefined}>
      <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <header className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 font-mono text-lg font-bold text-white">
                R
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">ADHD Reader</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  RSVP speed reading with ORP alignment.
                </p>
              </div>
            </div>
          </header>

          <AdhdReader
            text={text}
            language={language}
            wpm={wpm}
            onWpmChange={setWpm}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            theme={theme}
            onThemeChange={setTheme}
            mergeShortWords={mergeShortWords}
            punctuationPauses={punctuationPauses}
          />

          <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/5 sm:p-6 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Sample
              </span>
              {SAMPLE_TEXTS.map((sample) => (
                <TabButton
                  key={sample.id}
                  active={sourceId === sample.id}
                  onClick={() => setSourceId(sample.id)}
                  title={sample.nativeLabel}
                >
                  {sample.label}
                </TabButton>
              ))}
              <TabButton
                active={sourceId === 'custom'}
                onClick={() => setSourceId('custom')}
                title="Paste your own text"
              >
                Custom
              </TabButton>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Text
              </span>
              <textarea
                value={text}
                onChange={(event) => handleTextChange(event.target.value)}
                rows={7}
                spellCheck={false}
                placeholder="Paste your own text here…"
                className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-3 font-sans text-sm leading-relaxed text-slate-800 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Language
                </span>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as ReaderLanguageOption)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col justify-center gap-2">
                <Toggle
                  checked={mergeShortWords}
                  onChange={setMergeShortWords}
                  label="Merge short words"
                  hint={'"in the", "of a", "to the"'}
                />
                <Toggle
                  checked={punctuationPauses}
                  onChange={setPunctuationPauses}
                  label="Punctuation pauses"
                  hint="longer stop on . , ? ! —"
                />
              </div>
            </div>

            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {stats.words} words → <strong className="font-semibold">{stats.frames}</strong>{' '}
                frames
              </span>
              <span>
                ≈ <strong className="font-semibold">{Math.round(stats.words / (wpm / 60))}</strong> s
                at {wpm} WPM
              </span>
            </p>
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-2 pb-6 text-xs text-slate-500 dark:text-slate-400">
            <p className="flex flex-wrap items-center gap-2">
              <Kbd>Space</Kbd> play / pause
              <Kbd>←</Kbd>
              <Kbd>→</Kbd> step one word
              <Kbd>R</Kbd> reset
            </p>
            <p>MIT licensed — copy the component and ship it.</p>
          </footer>
        </div>
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}

function TabButton({ active, title, onClick, children }: TabButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={[
        'h-9 rounded-xl border px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500',
        active
          ? 'border-rose-600 bg-rose-600 text-white'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint: string;
}

function Toggle({ checked, onChange, label, hint }: ToggleProps): JSX.Element {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-rose-600"
      />
      <span>
        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>{' '}
        <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      </span>
    </label>
  );
}

function Kbd({ children }: { children: ReactNode }): JSX.Element {
  return (
    <kbd className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {children}
    </kbd>
  );
}
