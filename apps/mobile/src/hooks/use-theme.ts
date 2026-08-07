/**
 * Reading the Dageraad/Gloed tokens from code that can't use a `className`.
 *
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Brand, Colors } from '@/constants/theme';
// The two-phase hook, not RN's raw one: on the static web export the server
// renders light, and raw useColorScheme reports 'dark' from the very first
// client render — hydration then adopts the server's light inline styles while
// the virtual tree already says dark, so nothing ever patches them. The
// two-phase hook returns 'light' during hydration and flips after mount, which
// re-renders every consumer with changed values and repairs the DOM.
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppearance } from '@/lib/appearance';

/**
 * The app's effective theme, driven by the persisted appearance preference (see
 * {@link useAppearance}); `'system'` falls back to the OS color scheme.
 *
 * This — not RN's `useColorScheme()` — is the single source of truth for every
 * themed value the app computes in JS. RN's hook only sees an explicit override
 * on native, where `lib/appearance.ts` pushes it into `Appearance`; on web that
 * call is a no-op (react-native-web has no `setColorScheme`), so a user who
 * forces dark on web would get NativeWind's dark `className` styles over light
 * StyleSheet/SVG/MapLibre colors. Resolving the preference here keeps both
 * halves of the theme in lock-step on every platform.
 */
export function useResolvedScheme(): 'light' | 'dark' {
  const colorScheme = useColorScheme();
  const { appearance } = useAppearance();
  const effective = appearance === 'system' ? colorScheme : appearance;
  return effective === 'dark' ? 'dark' : 'light';
}

/** The neutral tokens (background, surface, card, border, text) for the active theme. */
export function useTheme() {
  return Colors[useResolvedScheme()];
}

/** The brand tokens (accent, strong, text, success) for the active theme. */
export function useBrand() {
  return Brand[useResolvedScheme()];
}
