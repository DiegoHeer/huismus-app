import { DataProvider, queryClient } from '@huismus/data';
import { initI18n } from '@huismus/i18n';
import type { CityShape } from '@huismus/types';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';

import MapScreen from '@/app/(tabs)/index';
import { loadAreas, loadCities, loadStats } from '@/lib/area-cache';

// The camera-idle auto-load hit-tests the viewport centre against the country's
// municipality shapes. Those are a large download, and the residence query
// deliberately doesn't wait for them — so on a cold start the camera routinely
// settles before they arrive, the hit-test finds nothing, and the neighborhoods
// have to be picked up when the shapes land rather than on the next gesture.

jest.mock('@/lib/area-cache', () => ({
  loadCities: jest.fn(),
  loadAreas: jest.fn(async () => []),
  loadStats: jest.fn(async () => []),
}));

const mockLoadCities = loadCities as jest.MockedFunction<typeof loadCities>;
const mockLoadAreas = loadAreas as jest.MockedFunction<typeof loadAreas>;

/** A municipality covering the whole of the settled viewport below. */
const AMSTERDAM: CityShape = {
  code: '0363',
  name: 'Amsterdam',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [4.0, 51.0],
        [6.0, 51.0],
        [6.0, 53.0],
        [4.0, 53.0],
        [4.0, 51.0],
      ],
    ],
  },
};

afterEach(() => {
  queryClient.clear();
  jest.clearAllMocks();
  (loadStats as jest.Mock).mockResolvedValue([]);
  mockLoadAreas.mockResolvedValue([]);
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

/** Settle the camera zoomed in past the auto-load threshold. */
function settleCamera(map: unknown) {
  fireEvent(map as never, 'regionDidChange', {
    nativeEvent: { center: [4.9, 52.37], zoom: 13, bounds: [4.75, 52.3, 5.05, 52.43] },
  });
}

describe('MapScreen neighborhood auto-load', () => {
  it('loads the city under the camera as soon as the shapes arrive', async () => {
    // Hold the municipality shapes back so the camera settles without them,
    // exactly as it does on a cold start.
    let deliverCities!: (cities: CityShape[]) => void;
    mockLoadCities.mockReturnValue(
      new Promise((resolve) => {
        deliverCities = resolve;
      }),
    );

    const { getByTestId } = await renderScreen();
    settleCamera(getByTestId('maplibre-map'));

    // Nothing to hit-test against yet, so no neighborhoods are asked for.
    await waitFor(() => expect(mockLoadAreas).not.toHaveBeenCalled());

    deliverCities([AMSTERDAM]);

    // No second gesture: the shapes landing is enough.
    await waitFor(() => expect(mockLoadAreas).toHaveBeenCalledWith('0363'));
  });

  it('still auto-loads normally when the shapes are already cached', async () => {
    mockLoadCities.mockResolvedValue([AMSTERDAM]);

    const { getByTestId } = await renderScreen();
    settleCamera(getByTestId('maplibre-map'));

    await waitFor(() => expect(mockLoadAreas).toHaveBeenCalledWith('0363'));
  });

  it('leaves the map alone below the auto-load zoom', async () => {
    // Panning the country at a glance must not keep swapping cities underfoot.
    mockLoadCities.mockResolvedValue([AMSTERDAM]);

    const { getByTestId } = await renderScreen();
    fireEvent(getByTestId('maplibre-map') as never, 'regionDidChange', {
      nativeEvent: { center: [4.9, 52.37], zoom: 9, bounds: [3.5, 51.5, 6.3, 53.2] },
    });

    await waitFor(() => expect(mockLoadCities).toHaveBeenCalled());
    expect(mockLoadAreas).not.toHaveBeenCalled();
  });
});
