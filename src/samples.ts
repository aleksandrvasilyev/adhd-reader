export interface SampleText {
  /** Stable id, also used as the tab value. */
  id: string;
  /** Short tab label. */
  label: string;
  /** Longer name for tooltips. */
  nativeLabel: string;
  text: string;
}

/**
 * Demo samples. The text mixes short function words, long words, commas,
 * dashes and paragraph breaks so merging and pause logic show up clearly.
 */
export const SAMPLE_TEXTS: readonly SampleText[] = [
  {
    id: 'demo',
    label: 'Demo',
    nativeLabel: 'How RSVP works',
    text: `Rapid Serial Visual Presentation — RSVP for short — removes the most expensive part of reading: moving your eyes. Words arrive one at a time, always in the same place, so the only thing left to do is understand them.

The red letter marks the Optimal Recognition Point: the spot your eye lands on when it recognises a word. Short words like "in the" or "of a" are glued together so they do not flicker; commas and full stops still leave you room to breathe.

For a brain that struggles with focus, this matters. There is no line to lose, no paragraph to read twice, no temptation to skip ahead. Start around 300 words per minute, then push the slider higher once the rhythm feels comfortable — and notice how the pauses still let you think.`,
  },
];

export const DEFAULT_SAMPLE: SampleText = SAMPLE_TEXTS[0] as SampleText;
