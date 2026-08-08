import { DataProvider, queryClient } from '@huismus/data';
import { initI18n } from '@huismus/i18n';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { View } from 'react-native';

import MapScreen from '@/app/(tabs)/index';
import { clearMapCamera, rememberedMapCamera } from '@/lib/map-camera';

// Leaving the map for another tab and coming back should change nothing: same
// framing, same pins, no request. Two separate things have to hold for that —
// the screen surviving a remount with its viewport intact, and a settle that is
// only the container resizing not being mistaken for the user going somewhere.
//
// Its own file because the test renderer stops being able to mount anything
// after a few map screens in one suite, and each case here needs two.
//
// The stated exception — nothing preloaded, so returning must fetch — is not
// here: it is already what `map.test.tsx` proves every time it settles a cold
// camera and expects a request, since the map now passes `refetchOnMount:
// false` on every one of those.

const realFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = realFetch;
  queryClient.clear();
  // Outlives the screen by design, so each case has to start from a cold map.
  clearMapCamera();
});

/** A geocoded residence summary, enough for `summaryToListing`. */
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

/** Answer every residence request with one page holding `items`. */
function serveResidences(items: unknown[]) {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ items, total: items.length, limit: 100, offset: 0, has_more: false }),
  });
}

const residenceUrls = () =>
  (global.fetch as jest.Mock).mock.calls
    .map((c) => String(c[0]))
    .filter((u) => u.includes('/v1/residences'));

const bboxes = () =>
  residenceUrls()
    .map((u) => new URLSearchParams(u.split('?')[1] ?? '').get('bbox'))
    .filter((b): b is string => b !== null);

/** The distinct viewport-scoped residence queries the screen has keyed. */
const viewportQueries = () =>
  queryClient
    .getQueryCache()
    .findAll({ queryKey: ['listings', 'list'] })
    .filter((query) => query.queryHash.includes('bbox'));

/**
 * The map inside a host that can swap it out, which is what switching tabs
 * does: the screen unmounts while the query client and the module-level stores
 * carry on. Driven through `rerender` so there is only ever one root —
 * unmounting a tree by hand and rendering a second one leaves the test renderer
 * unable to mount anything afterwards.
 */
async function renderTabHost() {
  const i18n = initI18n('en');
  const host = (onMap: boolean) => (
    <I18nextProvider i18n={i18n}>
      <DataProvider>{onMap ? <MapScreen /> : <View testID="other-tab" />}</DataProvider>
    </I18nextProvider>
  );
  // `render` resolves asynchronously here, hence the awaits throughout.
  const screen = await render(host(true));
  // Returned alongside rather than merged into the result, which neither
  // spreads (its queries are not own properties) nor accepts new ones.
  return {
    screen,
    leave: () => screen.rerender(host(false)),
    comeBack: () => screen.rerender(host(true)),
  };
}

/**
 * Settle the camera on a viewport. The centre is derived from the bounds rather
 * than fixed, because that is the one relationship a real map guarantees — and
 * the screen leans on it to tell a pan from the container resizing under a
 * stationary camera.
 */
function settleCamera(
  map: unknown,
  bounds: [number, number, number, number],
  zoom = 13,
) {
  const [west, south, east, north] = bounds;
  fireEvent(map as never, 'regionDidChange', {
    nativeEvent: { center: [(west + east) / 2, (south + north) / 2], zoom, bounds },
  });
}

describe('MapScreen returning to the tab', () => {
  it('puts back the same pins with no request and nothing to animate', async () => {
    serveResidences([residence(1, 500_000)]);
    const tab = await renderTabHost();
    settleCamera(tab.screen.getByTestId('maplibre-map'), [4.75, 52.3, 5.05, 52.43]);
    await waitFor(() => expect(tab.screen.getByText('€500k')).toBeTruthy());
    const requestsBefore = residenceUrls().length;

    await tab.leave();
    await tab.comeBack();

    // Present on the very first frame, before anything can be awaited: the
    // restored viewport keys the query, React Query answers it from cache
    // synchronously, and so the pins are initial state rather than an arrival —
    // which is what leaves them nothing to animate.
    expect(tab.screen.getByText('€500k')).toBeTruthy();
    expect(tab.screen.queryByTestId('map-initial-loading')).toBeNull();
    expect(residenceUrls()).toHaveLength(requestsBefore);

    // And it stays that way once the remounted map reports its camera.
    settleCamera(tab.screen.getByTestId('maplibre-map'), [4.75, 52.3, 5.05, 52.43]);
    await waitFor(() => expect(tab.screen.getByText('€500k')).toBeTruthy());
    expect(residenceUrls()).toHaveLength(requestsBefore);
  });

  it('reopens on the framing the user left, not the default', async () => {
    serveResidences([residence(1, 500_000)]);
    const tab = await renderTabHost();
    settleCamera(tab.screen.getByTestId('maplibre-map'), [5.35, 52.1, 5.65, 52.23]);
    await waitFor(() => expect(bboxes().length).toBeGreaterThan(0));
    const leftOn = bboxes().at(-1);

    // What survives the unmount, and so what the remounted map opens on. (The
    // maplibre mock drops the Camera's props, so the store is where this is
    // observable; the screen hands it straight to `initialCamera`.)
    expect(rememberedMapCamera()).toMatchObject({ longitude: 5.5, zoom: 13 });

    await tab.leave();
    await tab.comeBack();
    settleCamera(tab.screen.getByTestId('maplibre-map'), [5.35, 52.1, 5.65, 52.23]);

    // The same rectangle as before the switch, not the national default.
    await waitFor(() => expect(bboxes().at(-1)).toBe(leftOn));
  });

  it('ignores the container resize a tab transition reports', async () => {
    // Taken from the real sequence on web: leaving the tab collapses the map's
    // container, so it re-reports a *stationary* camera through a much smaller
    // window, and coming back re-reports the original. Neither is a move, and
    // treating either as one refetches homes the user never navigated from.
    serveResidences([residence(1, 500_000)]);
    const tab = await renderTabHost();
    const map = tab.screen.getByTestId('maplibre-map');

    settleCamera(map, [4.698, 52.267, 5.11, 52.468], 11);
    await waitFor(() => expect(residenceUrls()).toHaveLength(1));

    // Same centre, same zoom, a third of the area — the panel collapsing.
    settleCamera(map, [4.835, 52.336, 4.973, 52.399], 11);
    // And expanding again on the way back.
    settleCamera(map, [4.698, 52.267, 5.11, 52.468], 11);
    await waitFor(() => expect(viewportQueries()).toHaveLength(1));

    expect(residenceUrls()).toHaveLength(1);
    expect(tab.screen.getByText('€500k')).toBeTruthy();
  });

});
