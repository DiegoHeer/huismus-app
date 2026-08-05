import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useAppearance } from '@/lib/appearance';

/**
 * The scheme the web UI is actually painted in.
 *
 * Resolved from the app's appearance preference, not from RN's `useColorScheme()`
 * alone: react-native-web has no `Appearance.setColorScheme`, so an explicit
 * light/dark override never reaches RN's hook (see `lib/appearance.ts`) and it
 * keeps reporting the OS media query. NativeWind *does* get the override, so
 * every `dark:` class flips while anything colored from this hook — the stroked
 * SVG icons, the map style — would stay on the OS scheme and disappear against
 * the themed background. Only `'system'` defers to the OS.
 *
 * Returns `'light'` until hydration so it matches the static web export's markup.
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: detect SSR hydration on mount
    setHasHydrated(true);
  }, []);

  const systemScheme = useRNColorScheme();
  const { appearance } = useAppearance();

  if (!hasHydrated) return 'light';

  return appearance === 'system' ? systemScheme : appearance;
}
