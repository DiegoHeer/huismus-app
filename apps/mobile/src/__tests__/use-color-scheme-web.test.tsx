import { act, renderHook } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

// The `.web` variant explicitly — Jest resolves the native module by default.
import { useColorScheme } from '@/hooks/use-color-scheme.web';
import { setAppearance } from '@/lib/appearance';

beforeEach(() => {
  setAppearance('system');
});

afterEach(() => {
  jest.restoreAllMocks();
  setAppearance('system');
});

/** Drive what RN's own hook reports, i.e. the browser's OS media query. */
function mockSystemScheme(scheme: 'light' | 'dark') {
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(scheme);
}

describe('useColorScheme (web)', () => {
  it('follows an explicit override, which react-native-web never learns about', async () => {
    // The OS says light; the user picked dark in the app. NativeWind flips every
    // `dark:` class, so anything colored from this hook (stroked SVG icons, the
    // map style) has to flip with it or it vanishes against the dark background.
    mockSystemScheme('light');
    setAppearance('dark');

    const { result } = await renderHook(() => useColorScheme());

    expect(result.current).toBe('dark');
  });

  it('follows an explicit light override even when the OS is dark', async () => {
    mockSystemScheme('dark');
    setAppearance('light');

    const { result } = await renderHook(() => useColorScheme());

    expect(result.current).toBe('light');
  });

  it('defers to the OS scheme in system mode', async () => {
    mockSystemScheme('dark');

    const { result } = await renderHook(() => useColorScheme());

    expect(result.current).toBe('dark');
  });

  it('tracks a later appearance change', async () => {
    mockSystemScheme('light');

    const { result } = await renderHook(() => useColorScheme());
    expect(result.current).toBe('light');

    await act(async () => {
      setAppearance('dark');
    });

    expect(result.current).toBe('dark');
  });
});
