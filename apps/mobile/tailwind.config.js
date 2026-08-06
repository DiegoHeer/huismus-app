/** @type {import('tailwindcss').Config} */

// Every token resolves through a CSS variable declared in src/global.css, so a
// single utility (`bg-card`) is correct in both themes and a `dark:` variant is
// only needed where a rule differs by more than its color. The `<alpha-value>`
// placeholder is what makes `bg-card/80` and `border-border/60` work — Tailwind
// substitutes the opacity into the rgb() at build time, which is also why the
// variables hold space-separated channels rather than hex.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    // Shared UI package so its className usage is picked up too.
    '../../packages/ui/src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  // 'class' (not 'media') so the appearance preference can drive dark mode
  // manually via NativeWind's `colorScheme.set()` (see lib/appearance.ts).
  // Under 'media', dark mode is locked to the OS and `colorScheme.set()` throws.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dageraad & Gloed (design system §3). Semantic names only — reach for
        // the role, not the shade. The stock Tailwind palette is extended rather
        // than replaced: the legends in lib/map-overlays.ts encode external
        // datasets and keep their own colors.
        bg: token('bg'),
        surface: token('surface'),
        card: token('card'),
        border: token('border'),
        ink: token('ink'),
        'ink-2': token('ink-2'),
        accent: token('accent'),
        'accent-strong': token('accent-strong'),
        'accent-text': token('accent-text'),
        success: token('success'),
        badge: token('badge'),
      },
      // No `fontFamily` here on purpose. The families are seeded by the Text /
      // DisplayText primitives in @huismus/ui, and a `font-*` class would be a
      // footgun next to them: NativeWind resolves className into the element
      // *before* its style prop, so the seeded family would beat the class and
      // `font-display` would silently do nothing. Leaving the utilities
      // undefined makes that a build error instead of a wrong-looking screen.
    },
  },
  plugins: [],
};
