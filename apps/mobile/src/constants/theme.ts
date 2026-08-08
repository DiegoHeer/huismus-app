/**
 * Dageraad (light) & Gloed (dark) — the design tokens in plain hex.
 *
 * This is the second of the theme's two faces. Everything styled with a
 * `className` reads the tokens as CSS variables through Tailwind (see
 * src/global.css and tailwind.config.js); everything that can't — RN
 * StyleSheets, react-native-svg props, MapLibre layer paint, the expo-router
 * navigation theme — reads them from here. The values are identical and have to
 * be changed in both places at once.
 *
 * Both faces are in turn kept value-for-value in sync with huismus-web's
 * src/styles/tokens.css, so the app and the marketing site stay one brand.
 * Spec §3; see docs/theme.html for the reference sheet.
 */

import '@/global.css';

export const Colors = {
  light: {
    /** Page ground. */
    background: '#FAF6F0',
    /** Tinted sections and chips — one step up from the ground. */
    surface: '#F1E9DE',
    /** Cards and inputs — the layer floating above the ground. */
    card: '#FFFFFF',
    /** Hairlines and dividers. */
    border: '#E6DCCE',
    /** Headings and body text. */
    text: '#2A231C',
    /** Secondary and supporting text. */
    textSecondary: '#6F6354',
  },
  dark: {
    background: '#16110D',
    surface: '#211A14',
    card: '#261F18',
    border: '#362C22',
    text: '#F5EDE4',
    textSecondary: '#A99C8C',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Brand red, per theme. Rationed by the design system's "red budget" to the
 * places that carry brand or signal meaning — the primary CTA, map pins, the
 * live dot, links and eyebrows, and the in-place state affordances that stand
 * in for a CTA (an on switch, a checked option, a selected pill).
 *
 * `accent` is the fill, `strong` the pressed/hover step, and `text` the tint
 * tuned to clear AA against `background` — use that one, never `accent`, for
 * type sitting on a page ground.
 *
 * Deliberately *not* used for destructive actions: red is the brand here, so a
 * filled red "Delete account" would read exactly like a filled red "Bekijk
 * aanbod". Destructive controls are ink-outlined ghost buttons instead.
 */
export const Brand = {
  light: {
    accent: '#D7442E',
    strong: '#BC2828',
    text: '#B3301C',
    success: '#3E7C4F',
  },
  dark: {
    accent: '#E85B41',
    strong: '#D7442E',
    text: '#FF8A66',
    success: '#7FB58C',
  },
} as const;

/**
 * A token at partial alpha, as an `rgba()` string.
 *
 * For the className side this is what `bg-accent/55` already does; this is the
 * same thing for the RN StyleSheet / SVG / MapLibre side. Reach for it instead
 * of putting `opacity` on the element whenever only *one* colour should fade —
 * `opacity` composites the whole subtree, so a badge's outline and its label
 * fade along with its fill (see the viewed map pins in components/listing-map).
 */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * The hero washes, top-to-bottom stops. Spec §3 "Gradients".
 *
 * Unused by the app — mirrored from huismus-web's `--hero-gradient` /
 * `--dusk-gradient` to keep this file a complete copy of `tokens.css`, which is
 * the invariant the whole token layer rests on. Deleting it would make the two
 * files diverge for the first time. Same reason `--badge` sits unused in
 * global.css.
 */
export const Gradients = {
  /** Dageraad — red into coral into warm paper. */
  light: ['#D7442E', '#C63A2B', '#D97A5A', '#F0DFC9', '#FAF6F0'],
  /** Gloed — charcoal with an ember glow and a coral core low in the frame. */
  dark: ['#BC2828', '#A5231B', '#571C14', '#2A1712', '#16110D'],
} as const;

/**
 * The type half of the tokens, re-exported so `@/constants/theme` stays the one
 * import for everything themed on the StyleSheet side.
 *
 * It's *defined* in `@huismus/ui` because that's where the `Text` primitives
 * that seed it live, and a cross-package component can't reach into
 * `apps/mobile`. See packages/ui/src/fonts.ts.
 */
export { Fonts } from '@huismus/ui';

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
