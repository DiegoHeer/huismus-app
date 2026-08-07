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

/**
 * Settle the native camera on a viewport, as the map does once it has loaded and
 * after every gesture. The screen holds the residence query until the map
 * reports a camera, so a test that expects a request must fire this first — the
 * maplibre mock renders an inert View and reports nothing on its own.
 */
function settleCamera(
  map: unknown,
  bounds: [number, number, number, number] = [4.75, 52.3, 5.05, 52.43],
  zoom = 13,
) {
  fireEvent(map as never, 'regionDidChange', {
    nativeEvent: { center: [4.9, 52.37], zoom, bounds },
  });
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
    const { getByText, getByTestId } = await renderScreen();
    settleCamera(getByTestId('maplibre-map'));

    // The map queries with the default, unfiltered query — no status constraint.
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

  it('makes no request until the map reports a camera', async () => {
    // Otherwise the screen would spend a nationwide fetch on markers the very
    // next render replaces with the viewport-scoped ones.
    await renderScreen();
    await waitFor(() => expect(residenceUrls().length).toBe(0));
  });

  it('shows the loading state while waiting for the camera', async () => {
    // A disabled query is `isPending` with `isFetching` false, so `isLoading` is
    // false — the screen has to treat "no camera yet" as loading itself, or it
    // sits on an empty map that reads as "there are no homes here".
    const { getByTestId, queryByTestId } = await renderScreen();
    expect(getByTestId('map-initial-loading')).toBeTruthy();

    settleCamera(getByTestId('maplibre-map'));
    await waitFor(() => expect(queryByTestId('map-initial-loading')).toBeNull());
  });

  /** One geocoded residence summary, enough for `summaryToListing`. */
  const residence = (id: number, price: number) => ({
    id,
    city: 'Amsterdam',
    street: 'Teststraat',
    house_number: id,
    house_letter: null,
    house_number_suffix: null,
    postcode: '1011 AB',
    slug: `teststraat-${id}`,
    latitude: 52.37,
    longitude: 4.89,
    current_price_eur: price,
    current_status: 'new',
  });

  const residencePage = (items: unknown[]) => ({
    ok: true,
    json: async () => ({ items, total: items.length, limit: 100, offset: 0, has_more: false }),
  });

  /** Respond to every residence request with one page holding `items`. */
  const serveResidences = (items: unknown[]) => {
    (global.fetch as jest.Mock).mockResolvedValue(residencePage(items));
  };

  /**
   * Hold the next request open until `release()`. The mock otherwise resolves
   * within the same tick, which leaves the in-flight state too brief to observe
   * — and these tests are entirely about what the screen shows during it.
   */
  const holdNextRequest = (items: unknown[]) => {
    let release!: () => void;
    const pending = new Promise((resolve) => {
      release = () => resolve(residencePage(items));
    });
    (global.fetch as jest.Mock).mockReturnValueOnce(pending);
    return { release };
  };

  /** True once a viewport's request is actually in flight, not merely queued. */
  const isFetchingAViewport = () =>
    viewportQueries().some((query) => query.state.fetchStatus === 'fetching');

  it('reloads a new viewport silently while markers are still on the map', async () => {
    // Panning must not throw a spinner over a map the user is reading. The
    // previous viewport's pins stay put (keepPrevious) and are simply replaced
    // when the new ones land.
    serveResidences([residence(1, 500_000)]);
    const { getByTestId, getByText, queryByTestId } = await renderScreen();
    const map = getByTestId('maplibre-map');

    settleCamera(map, [4.75, 52.3, 5.05, 52.43]);
    await waitFor(() => expect(getByText('€500k')).toBeTruthy());

    const next = holdNextRequest([residence(2, 750_000)]);
    settleCamera(map, [5.35, 52.3, 5.65, 52.43]);
    await waitFor(() => expect(isFetchingAViewport()).toBe(true));

    // Mid-flight, with the request provably still open: nothing covers the map,
    // and the outgoing viewport's marker is still the one on screen.
    expect(queryByTestId('map-initial-loading')).toBeNull();
    expect(queryByTestId('map-background-loading')).toBeNull();
    expect(getByText('€500k')).toBeTruthy();

    next.release();
    await waitFor(() => expect(getByText('€750k')).toBeTruthy());
    expect(queryByTestId('map-initial-loading')).toBeNull();
  });

  it('keeps a home that dropped out of the results on the map while it fades', async () => {
    // React unmounts a marker the frame its listing disappears, which leaves
    // nothing to animate. The old pin has to outlive its data.
    serveResidences([residence(1, 500_000)]);
    const { getByTestId, getByText, queryByText } = await renderScreen();
    const map = getByTestId('maplibre-map');

    settleCamera(map, [4.75, 52.3, 5.05, 52.43]);
    await waitFor(() => expect(getByText('€500k')).toBeTruthy());

    // A viewport where that home no longer matches.
    serveResidences([residence(2, 750_000)]);
    settleCamera(map, [5.35, 52.3, 5.65, 52.43]);
    await waitFor(() => expect(getByText('€750k')).toBeTruthy());

    // Still mounted, mid-fade, alongside the new arrival.
    expect(getByText('€500k')).toBeTruthy();

    // And gone once the fade has had its window.
    await waitFor(() => expect(queryByText('€500k')).toBeNull(), { timeout: 2000 });
    expect(getByText('€750k')).toBeTruthy();
  });

  it('shows the spinner when a new viewport loads over an empty map', async () => {
    // Nothing to look at instead, so the spinner is the only signal that the
    // map is working rather than simply empty.
    const { getByTestId, queryByTestId } = await renderScreen();
    const map = getByTestId('maplibre-map');

    settleCamera(map, [4.75, 52.3, 5.05, 52.43]);
    await waitFor(() => expect(residenceUrls()).toHaveLength(1));
    // Settled and empty is not loading — no spinner over a map that is simply
    // showing no homes here.
    expect(queryByTestId('map-initial-loading')).toBeNull();

    const next = holdNextRequest([]);
    settleCamera(map, [5.35, 52.3, 5.65, 52.43]);

    await waitFor(() => expect(getByTestId('map-initial-loading')).toBeTruthy());
    next.release();
    await waitFor(() => expect(queryByTestId('map-initial-loading')).toBeNull());
  });

  it('says so when more homes match the viewport than it can draw', async () => {
    // The page cap is otherwise invisible: 300 pins look the same whether that
    // is every home in the area or a slice of four thousand.
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 4000, limit: 100, offset: 0, has_more: true }),
    });
    const { getByTestId, getByText } = await renderScreen();

    settleCamera(getByTestId('maplibre-map'));

    await waitFor(() => expect(getByTestId('map-capped-results')).toBeTruthy());
    expect(getByText(/of 4,000 homes/)).toBeTruthy();
  });

  it('stays quiet when the viewport holds fewer homes than the cap', async () => {
    const { getByTestId, queryByTestId } = await renderScreen();

    settleCamera(getByTestId('maplibre-map'));

    await waitFor(() => expect(bboxes().length).toBeGreaterThan(0));
    expect(queryByTestId('map-capped-results')).toBeNull();
  });

  it('requests the residences inside the viewport once the camera settles', async () => {
    const { getByTestId } = await renderScreen();

    settleCamera(getByTestId('maplibre-map'), [4.75, 52.3, 5.05, 52.43]);

    await waitFor(() => expect(bboxes().length).toBeGreaterThan(0));
    // The bbox is on the *first* request — no unscoped fetch precedes it.
    expect(bboxes().length).toBe(residenceUrls().length);

    // The requested rectangle must cover everything the user can see — the
    // query is padded and snapped outward, never cropped.
    const [west, south, east, north] = bboxes().at(-1)!.split(',').map(Number) as number[];
    expect(west!).toBeLessThanOrEqual(4.75);
    expect(south!).toBeLessThanOrEqual(52.3);
    expect(east!).toBeGreaterThanOrEqual(5.05);
    expect(north!).toBeGreaterThanOrEqual(52.43);
  });

  /**
   * The distinct *viewport-scoped* residence queries the screen has asked for.
   * A cache entry appears the moment a settle produces a new query key, so
   * counting these says whether a settle was a new rectangle or the same one —
   * without racing whatever the fetch scheduler is doing.
   *
   * The unscoped entry React Query keys before the camera reports is filtered
   * out: it is disabled and never fetched, so it is not a viewport.
   */
  const viewportQueries = () =>
    queryClient
      .getQueryCache()
      .findAll({ queryKey: ['listings', 'list'] })
      .filter((query) => query.queryHash.includes('bbox'));

  it('re-requests for a real pan but not for a nudge', async () => {
    const { getByTestId } = await renderScreen();
    const map = getByTestId('maplibre-map');

    settleCamera(map, [4.75, 52.3, 5.05, 52.43]);
    await waitFor(() => expect(residenceUrls()).toHaveLength(1));

    // A few pixels of drift must not refetch — it snaps to the same rectangle,
    // so the query key is unchanged and React Query serves the cache. The
    // settle renders synchronously, so a rectangle that had missed the grid
    // would already have keyed its own cache entry by the time this runs.
    settleCamera(map, [4.751, 52.301, 5.051, 52.431]);
    await waitFor(() => expect(viewportQueries()).toHaveLength(1));

    // Panning a viewport's width away is a different rectangle, so it reloads.
    settleCamera(map, [5.35, 52.3, 5.65, 52.43]);
    await waitFor(() => expect(residenceUrls()).toHaveLength(2));

    // Two rectangles, two requests — the nudge cost nothing.
    expect(viewportQueries()).toHaveLength(2);
    expect(new Set(bboxes()).size).toBe(2);
  });

  it('keeps a fetched viewport fresh, so panning back to it is free', async () => {
    // Quantizing only makes a *nudge* free. Without a staleTime React Query
    // marks every result stale the moment it lands, so panning to and fro
    // around a city — an ordinary gesture — would pay the round trip each way.
    const { getByTestId } = await renderScreen();

    settleCamera(getByTestId('maplibre-map'), [4.75, 52.3, 5.05, 52.43]);
    await waitFor(() => expect(residenceUrls()).toHaveLength(1));

    expect(viewportQueries()[0]!.isStale()).toBe(false);
  });
});
