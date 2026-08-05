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
 * Spec §3; see theme/theme.html for the reference sheet.
 */

import '@/global.css';

import { Platform } from 'react-native';

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

/** The hero washes, top-to-bottom stops. Spec §3 "Gradients". */
export const Gradients = {
  /** Dageraad — red into coral into warm paper. */
  light: ['#D7442E', '#C63A2B', '#D97A5A', '#F0DFC9', '#FAF6F0'],
  /** Gloed — charcoal with an ember glow and a coral core low in the frame. */
  dark: ['#BC2828', '#A5231B', '#571C14', '#2A1712', '#16110D'],
} as const;

export const Fonts = Platform.select({
  // Registered natively by the expo-font config plugin (app.json), which embeds
  // all four weights of each family under a single family name so `fontWeight`
  // selects the right file rather than synthesising a bold. On web the same two
  // names come from @font-face in global.css.
  default: {
    display: 'Spline Sans',
    body: 'Inter',
    sans: 'Inter',
    serif: 'serif',
    rounded: 'Spline Sans',
    mono: 'monospace',
  },
  ios: {
    display: 'Spline Sans',
    body: 'Inter',
    sans: 'Inter',
    serif: 'ui-serif',
    rounded: 'Spline Sans',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  web: {
    display: 'var(--font-display)',
    body: 'var(--font-body)',
    sans: 'var(--font-body)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-display)',
    mono: 'var(--font-mono)',
  },
});

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
