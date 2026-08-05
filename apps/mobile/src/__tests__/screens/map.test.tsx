import { DataProvider, queryClient } from '@huismus/data';
import { initI18n } from '@huismus/i18n';
import type { Listing } from '@huismus/types';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';

import MapScreen from '@/app/(tabs)/index';
import { clearLikes, toggleLike } from '@/lib/likes';
import { clearRecentViews, recordRecentView } from '@/lib/recent-views';

afterEach(() => {
  queryClient.clear();
  // The likes / recent-views stores are module singletons — reset them so each
  // test starts clean.
  clearLikes();
  clearRecentViews();
});

// Prices are distinct so each marker's price bubble identifies its listing.
function makeListing(id: string, price: number): Listing {
  return {
    id,
    title: `Home ${id}`,
    price,
    currency: 'EUR',
    status: 'for_sale',
    bedrooms: 2,
    bathrooms: 1,
    areaSqm: 84,
    address: { line1: 'Teststraat 1', city: 'Amsterdam', postalCode: '1011 AB', country: 'NL' },
    location: { latitude: 52.37, longitude: 4.89 },
    images: [{ id: `${id}_img`, url: 'https://example.test/cover.jpg' }],
    createdAt: '2024-01-01T00:00:00.000Z',
  };
}

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

describe('MapScreen', () => {
  it('renders the map component', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => {
      expect(getByTestId('maplibre-map')).toBeTruthy();
    });
  });

  it('renders without crashing when data is loading', async () => {
    const { toJSON } = await renderScreen();
    expect(toJSON()).toBeTruthy();
  });

  it('toggles a map overlay and its legend from the layer pills', async () => {
    const { getByText, queryByText } = await renderScreen();

    // No overlay yet — no legend.
    expect(queryByText('dB')).toBeNull();

    // Toggling Noise on shows its legend (dB classes at any zoom).
    fireEvent.press(getByText('Noise'));
    await waitFor(() => {
      expect(getByText('dB')).toBeTruthy();
      expect(getByText('≤45')).toBeTruthy();
    });

    // Overlays are mutually exclusive: switching to Air quality replaces the
    // noise legend with the NO2 one.
    fireEvent.press(getByText('Air quality'));
    await waitFor(() => {
      expect(queryByText('dB')).toBeNull();
      expect(getByText('µg/m³')).toBeTruthy();
    });

    // Tapping the active pill toggles it back off.
    fireEvent.press(getByText('Air quality'));
    await waitFor(() => {
      expect(queryByText('µg/m³')).toBeNull();
    });
  });

  it('hints to zoom in for building-level overlays at the initial zoom', async () => {
    const { getByText } = await renderScreen();
    // Energy labels only render around z≥15.5; the map starts at z11.
    fireEvent.press(getByText('Energy labels'));
    await waitFor(() => {
      expect(getByText('Zoom in to see this layer')).toBeTruthy();
    });
  });
});

// The Favorites/Recent pills swap the map's markers to the locally stored
// snapshots. The server query yields no listings in tests, so every price
// bubble on screen comes from the likes / recent-views stores.
describe('MapScreen snapshot pills', () => {
  it('shows liked homes while the Favorites pill is active, and reverts on toggle-off', async () => {
    toggleLike(makeListing('lst_fav', 500_000));
    const { getByText, queryByText } = await renderScreen();

    // Not filtered yet — the liked home's marker isn't on the map.
    expect(queryByText('€500k')).toBeNull();

    fireEvent.press(getByText('Favorites'));
    await waitFor(() => {
      expect(getByText('€500k')).toBeTruthy();
    });

    fireEvent.press(getByText('Favorites'));
    await waitFor(() => {
      expect(queryByText('€500k')).toBeNull();
    });
  });

  it('shows recently viewed homes while the Recent pill is active', async () => {
    recordRecentView(makeListing('lst_seen', 750_000));
    const { getByText, queryByText } = await renderScreen();

    expect(queryByText('€750k')).toBeNull();

    fireEvent.press(getByText('Recent'));
    await waitFor(() => {
      expect(getByText('€750k')).toBeTruthy();
    });
  });

  it('shows the union, deduped by id, when both pills are active', async () => {
    // One home is liked AND recently viewed; another is only recently viewed.
    const both = makeListing('lst_both', 500_000);
    toggleLike(both);
    recordRecentView(both);
    recordRecentView(makeListing('lst_seen', 750_000));
    const { getByText, getAllByText } = await renderScreen();

    fireEvent.press(getByText('Favorites'));
    await waitFor(() => {
      expect(getAllByText('€500k')).toHaveLength(1);
    });

    fireEvent.press(getByText('Recent'));
    await waitFor(() => {
      // Exactly one marker for the home in both stores — not two.
      expect(getAllByText('€500k')).toHaveLength(1);
      expect(getByText('€750k')).toBeTruthy();
    });
  });
});

// The Sold pill takes the opposite path from the snapshot pills: rather than
// swapping the data source to local snapshots, it narrows the *server* query to
// sold residences. Spying on fetch lets us assert the request carries the
// status filter (the API's `status=sold`, mapped from the app's `sold` status).
describe('MapScreen sold pill', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  // URLs of the residence-list requests fetch has seen so far.
  const residenceUrls = () =>
    (global.fetch as jest.Mock).mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes('/v1/residences'));

  it('requests only sold residences from the API while the Sold pill is active', async () => {
    const { getByText } = await renderScreen();

    // The map mounts with the default, unfiltered query — no status constraint.
    await waitFor(() => expect(residenceUrls().length).toBeGreaterThan(0));
    expect(residenceUrls().some((u) => u.includes('status=sold'))).toBe(false);

    fireEvent.press(getByText('Sold'));

    // Toggling Sold re-queries the API with status=sold, so the markers become
    // the sold homes the backend returns.
    await waitFor(() => {
      expect(residenceUrls().some((u) => u.includes('status=sold'))).toBe(true);
    });
  });
});

// Panning/zooming the map (and flying to a search result, which settles the
// camera the same way) reloads the residences for the newly visible rectangle,
// instead of keeping the fixed first page the screen fetched at mount.
describe('MapScreen viewport loading', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0, limit: 100, offset: 0, has_more: false }),
    });
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  const residenceUrls = () =>
    (global.fetch as jest.Mock).mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes('/v1/residences'));

  // Requests are relative in tests (no API_URL configured), so read the query
  // string directly rather than through `new URL`.
  const bboxes = () =>
    residenceUrls()
      .map((u) => new URLSearchParams(u.split('?')[1] ?? '').get('bbox'))
      .filter((b): b is string => b !== null);

  /** Settle the native camera on a viewport, as the map does after a gesture. */
  const settleCamera = (map: unknown, bounds: [number, number, number, number]) =>
    fireEvent(map as never, 'regionDidChange', {
      nativeEvent: { center: [4.9, 52.37], zoom: 13, bounds },
    });

  it('requests the residences inside the viewport once the camera settles', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(residenceUrls().length).toBeGreaterThan(0));

    settleCamera(getByTestId('maplibre-map'), [4.75, 52.3, 5.05, 52.43]);

    await waitFor(() => expect(bboxes().length).toBeGreaterThan(0));

    // The requested rectangle must cover everything the user can see — the
    // query is padded and snapped outward, never cropped.
    const [west, south, east, north] = bboxes().at(-1)!.split(',').map(Number) as number[];
    expect(west!).toBeLessThanOrEqual(4.75);
    expect(south!).toBeLessThanOrEqual(52.3);
    expect(east!).toBeGreaterThanOrEqual(5.05);
    expect(north!).toBeGreaterThanOrEqual(52.43);
  });

  it('re-requests for a real pan but not for a nudge', async () => {
    const { getByTestId } = await renderScreen();
    const map = getByTestId('maplibre-map');
    await waitFor(() => expect(residenceUrls().length).toBeGreaterThan(0));

    settleCamera(map, [4.75, 52.3, 5.05, 52.43]);
    await waitFor(() => expect(bboxes().length).toBeGreaterThan(0));
    const afterFirst = residenceUrls().length;

    // A few pixels of drift must not refetch — it snaps to the same rectangle,
    // so the query key is unchanged and React Query serves the cache.
    settleCamera(map, [4.751, 52.301, 5.051, 52.431]);
    await waitFor(() => expect(bboxes().length).toBeGreaterThan(0));
    expect(residenceUrls().length).toBe(afterFirst);

    // Panning a viewport's width away is a different rectangle, so it reloads.
    settleCamera(map, [5.35, 52.3, 5.65, 52.43]);
    await waitFor(() => expect(residenceUrls().length).toBeGreaterThan(afterFirst));
    const distinct = new Set(bboxes());
    expect(distinct.size).toBeGreaterThan(1);
  });
});
