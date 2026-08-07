import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Brand, Colors } from '@/constants/theme';

/**
 * The Dageraad & Gloed tokens are declared twice — as space-separated RGB
 * channels in `global.css` for the className side, and as hex in
 * `constants/theme.ts` for the StyleSheet / SVG / MapLibre side. Three doc
 * comments say to change both together; this is what actually enforces it.
 *
 * It also fails when a *new* variable appears in the CSS with no counterpart in
 * TS, so adding one forces a decision rather than silently landing on one side.
 */

const CSS = readFileSync(join(__dirname, '..', 'global.css'), 'utf8');

/** Which JS token each CSS variable has to equal, per theme. */
const MAPPING: Record<string, (scheme: 'light' | 'dark') => string> = {
  bg: (s) => Colors[s].background,
  surface: (s) => Colors[s].surface,
  card: (s) => Colors[s].card,
  border: (s) => Colors[s].border,
  ink: (s) => Colors[s].text,
  'ink-2': (s) => Colors[s].textSecondary,
  accent: (s) => Brand[s].accent,
  'accent-strong': (s) => Brand[s].strong,
  'accent-text': (s) => Brand[s].text,
  success: (s) => Brand[s].success,
};

/**
 * Variables with no JS counterpart on purpose. `--badge` is fixed dark chrome
 * for huismus-web's store badges and footer; the app has neither and mirrors it
 * only to keep global.css a complete copy of tokens.css.
 */
const CSS_ONLY = new Set(['badge']);

/** `--name: 12 34 56;` — the RGB triples only, so the `--font-*` vars are skipped. */
const TRIPLE = /--([a-z0-9-]+):\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*;/g;

function parseBlock(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, name, r, g, b] of css.matchAll(TRIPLE)) {
    const hex = [r, g, b]
      .map((c) => Number(c).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    out[name!] = `#${hex}`;
  }
  return out;
}

// The dark block is the one selected by `.dark`; everything before it is :root.
const darkAt = CSS.indexOf('.dark:root');
const BLOCKS = {
  light: parseBlock(CSS.slice(0, darkAt)),
  dark: parseBlock(CSS.slice(darkAt, CSS.indexOf('}', darkAt))),
};

describe('theme tokens', () => {
  it('finds both token blocks in global.css', () => {
    expect(darkAt).toBeGreaterThan(-1);
    expect(Object.keys(BLOCKS.light).length).toBeGreaterThan(0);
    expect(Object.keys(BLOCKS.dark)).toEqual(Object.keys(BLOCKS.light));
  });

  describe.each(['light', 'dark'] as const)('%s', (scheme) => {
    it.each(Object.keys(MAPPING))('--%s matches constants/theme.ts', (name) => {
      expect(BLOCKS[scheme][name]).toBe(MAPPING[name]!(scheme).toUpperCase());
    });

    it('has no CSS variable without a declared counterpart', () => {
      const unaccounted = Object.keys(BLOCKS[scheme]).filter(
        (name) => !(name in MAPPING) && !CSS_ONLY.has(name),
      );
      expect(unaccounted).toEqual([]);
    });
  });
});
