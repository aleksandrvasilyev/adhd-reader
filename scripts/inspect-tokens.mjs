/**
 * Dev helper: prints how a text is split into RSVP frames.
 *
 *   node scripts/inspect-tokens.mjs "в доме было тихо"
 *
 * Useful when tuning the short-word lists or the pause factors — the caret
 * under each frame marks the ORP character that is painted red.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '../src/components/AdhdReader/utils.ts');

const bundle = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});

const code = bundle.outputFiles[0].text;
const { tokenize, detectLanguage } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);

const text =
  process.argv.slice(2).join(' ') ||
  'The quick brown fox jumps over the lazy dog — and then, at last, it sleeps.';

const tokens = tokenize(text);
const words = text.trim().split(/\s+/u).length;

console.log(`language: ${detectLanguage(text)}`);
console.log(`${words} words -> ${tokens.length} frames\n`);

for (const token of tokens) {
  const caret = `${' '.repeat(token.orpIndex)}^`;
  console.log(`${token.text}\n${caret}  x${token.delayMultiplier}`);
}
