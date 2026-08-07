import { Platform } from 'react-native';

/**
 * The two families the design system ships, per platform.
 *
 * Lives in this package rather than the app's `constants/theme.ts` because
 * {@link ./text} needs it and a cross-package component cannot reach into
 * `apps/mobile`. The app re-exports it from `constants/theme.ts`, so
 * `Fonts.display` keeps resolving for its own StyleSheet consumers.
 *
 * The family names are exactly what the expo-font config plugin registers
 * natively (apps/mobile/app.json) and what `@font-face` declares on web
 * (apps/mobile/src/global.css), so one name works on all three platforms. The
 * plugin's Android `fontDefinitions` form embeds all four weights under a
 * single family name, which is what makes `fontWeight` select the right file
 * instead of synthesising a bold. iOS has no equivalent declaration and groups
 * the four by their typographic family (`name` ID 16), which is why
 * apps/mobile/src/__tests__/fonts.test.ts asserts those records survive — the
 * TTFs are subset by apps/mobile/scripts/subset-fonts.py, and a subsetter run
 * without `--name-IDs='*'` would strand Medium and SemiBold outside `Inter`.
 */
export const Fonts = Platform.select({
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
