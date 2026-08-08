import { DataProvider, queryClient } from '@huismus/data';
import { initI18n } from '@huismus/i18n';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';

import MapScreen from '@/app/(tabs)/index';
import { DEFAULT_CENTER } from '@/components/map-shared';

// The global mock in test-setup renders Camera as null, which drops its ref —
// re-mock the module so the camera moves the screen asks for are observable.
const mockFlyToCalls: { longitude: number; latitude: number; zoom?: number }[] = [];
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Camera = React.forwardRef((_props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      flyTo: ({ center, zoom }: any) =>
        mockFlyToCalls.push({ longitude: center[0], latitude: center[1], zoom }),
    }));
    return null;
  });
  Camera.displayName = 'Camera';
  return {
    Map: ({ children, ...props }: any) =>
      React.createElement(View, { testID: 'maplibre-map', ...props }, children),
    Camera,
    Marker: ({ children }: any) => children,
    GeoJSONSource: ({ children }: any) => children,
    RasterSource: ({ children }: any) => children,
    VectorSource: ({ children }: any) => children,
    Layer: () => null,
  };
});

async function renderScreen() {
  const i18n = initI18n('en');
  return render(
    <I18nextProvider i18n={i18n}>
      <DataProvider>
        <MapScreen />
      </DataProvider>
    </I18nextProvider>,
  );
}

/**
 * Report a settled camera, the way the native map does after a pan/zoom.
 *
 * Awaited: the pills read the camera through the screen's toggle callback, so
 * the resulting state update has to land before a press can see it.
 */
const settleCamera = async (
  screen: Awaited<ReturnType<typeof renderScreen>>,
  zoom: number,
  center: [number, number] = [4.89, 52.37],
) => {
  await act(async () => {
    fireEvent(screen.getByTestId('maplibre-map'), 'regionDidChange', {
      nativeEvent: { center, zoom },
    });
  });
};

beforeEach(() => {
  mockFlyToCalls.length = 0;
});

afterEach(() => {
  queryClient.clear();
});

// A layer that only paints at building zooms is useless from a country-wide
// view. Turning one on from up there closes the gap for the user instead of
// leaving them behind a "zoom in" hint.
describe('enabling a building-level layer from too far out', () => {
  it.each([
    ['WOZ value', 12],
    ['Building age', 12],
    ['Zoning', 13],
    ['Energy labels', 15.5],
  ])('zooms to %s’s floor', async (label, floor) => {
    const screen = await renderScreen();
    // The map mounts at z11 — below every one of these floors.
    fireEvent.press(screen.getByText(label));

    await waitFor(() => {
      expect(mockFlyToCalls).toHaveLength(1);
    });
    expect(mockFlyToCalls[0].zoom).toBe(floor);
  });

  it('descends on the centre the user is already looking at', async () => {
    const screen = await renderScreen();
    // Pan to Rotterdam and settle there, well above the WOZ layer's z12 floor.
    await settleCamera(screen, 9, [4.4777, 51.9244]);
    mockFlyToCalls.length = 0;

    fireEvent.press(screen.getByText('WOZ value'));

    await waitFor(() => {
      expect(mockFlyToCalls).toHaveLength(1);
    });
    // Straight down onto Rotterdam — not back to the mount framing.
    expect(mockFlyToCalls[0]).toEqual({ longitude: 4.4777, latitude: 51.9244, zoom: 12 });
    expect(mockFlyToCalls[0].longitude).not.toBe(DEFAULT_CENTER.longitude);
  });
});

describe('leaves the camera alone when it has no reason to move', () => {
  it('stays put when already deep enough for the layer', async () => {
    const screen = await renderScreen();
    await settleCamera(screen, 16);
    mockFlyToCalls.length = 0;

    fireEvent.press(screen.getByText('WOZ value'));

    await waitFor(() => {
      expect(screen.getByText('<€300k')).toBeTruthy();
    });
    expect(mockFlyToCalls).toHaveLength(0);
  });

  it('stays put for a ground-level layer, which paints at any zoom', async () => {
    const screen = await renderScreen();

    fireEvent.press(screen.getByText('Noise'));

    await waitFor(() => {
      expect(screen.getByText('dB')).toBeTruthy();
    });
    expect(mockFlyToCalls).toHaveLength(0);
  });

  it('stays put when a layer is switched off', async () => {
    const screen = await renderScreen();
    await settleCamera(screen, 16);

    fireEvent.press(screen.getByText('WOZ value'));
    await waitFor(() => {
      expect(screen.getByText('<€300k')).toBeTruthy();
    });
    mockFlyToCalls.length = 0;

    fireEvent.press(screen.getByText('WOZ value'));

    await waitFor(() => {
      expect(screen.queryByText('<€300k')).toBeNull();
    });
    expect(mockFlyToCalls).toHaveLength(0);
  });
});
