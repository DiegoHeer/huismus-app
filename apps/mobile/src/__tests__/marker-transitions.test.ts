import type { Listing } from '@huismus/types';

import {
  initialMarkerState,
  MARKER_ENTER_DELAY_MAX_MS,
  MARKER_ENTER_DELAY_MIN_MS,
  MARKER_EXIT_STAGGER_MS,
  reconcileMarkers,
  type MarkerPhase,
  type MarkerTransitionState,
} from '@/components/marker-transitions';

// A new viewport replaces the markers wholesale. The reconciler is what turns
// that into three groups — arriving, leaving, unchanged — so each pin can be
// animated, and what keeps a departing pin around long enough to fade at all.

function listing(id: string): Listing {
  return {
    id,
    title: `Home ${id}`,
    price: 400_000,
    currency: 'EUR',
    status: 'for_sale',
    bedrooms: 2,
    bathrooms: 1,
    areaSqm: 80,
    address: { line1: 'Teststraat 1', city: 'Amsterdam', postalCode: '1011 AB', country: 'NL' },
    location: { latitude: 52.37, longitude: 4.89 },
    images: [],
    createdAt: '',
  };
}

/** Phase per listing id, which is what every assertion here is really about. */
function phases(state: MarkerTransitionState): Record<string, MarkerPhase> {
  return Object.fromEntries(state.rendered.map((e) => [e.listing.id, e.phase]));
}

/** A state that has already shown a set of markers, so the next one animates. */
function seeded(ids: string[]): MarkerTransitionState {
  return initialMarkerState(ids.map(listing));
}

describe('reconcileMarkers', () => {
  it('splits a new set into arriving, leaving and unchanged', () => {
    const next = reconcileMarkers(seeded(['a', 'b']), [listing('b'), listing('c')]);

    expect(phases(next)).toEqual({ a: 'leaving', b: 'steady', c: 'entering' });
  });

  it('keeps a departing marker on the map so there is something to fade', () => {
    // The whole point: React would unmount it the frame its listing vanished.
    const next = reconcileMarkers(seeded(['a']), []);

    expect(next.rendered.map((e) => e.listing.id)).toEqual(['a']);
    expect(next.rendered[0]!.phase).toBe('leaving');
  });

  it('staggers arrivals and departures within their own windows', () => {
    // The two directions scatter over different ranges — arrivals trickle in
    // over a wide window, departures clear out quickly behind them.
    const next = reconcileMarkers(seeded(['a']), [listing('b'), listing('c')]);

    for (const entry of next.rendered) {
      if (entry.phase === 'entering') {
        expect(entry.delay).toBeGreaterThanOrEqual(MARKER_ENTER_DELAY_MIN_MS);
        expect(entry.delay).toBeLessThan(MARKER_ENTER_DELAY_MAX_MS);
      } else {
        expect(entry.delay).toBeGreaterThanOrEqual(0);
        expect(entry.delay).toBeLessThan(MARKER_EXIT_STAGGER_MS);
      }
    }
    expect(phases(next)).toEqual({ a: 'leaving', b: 'entering', c: 'entering' });
  });

  it('shows the first set without animating it', () => {
    // Everything is "new" on a cold open; animating all of it is a cascade over
    // the busiest moment of startup for no gain.
    const first = reconcileMarkers(initialMarkerState([]), [listing('a'), listing('b')]);

    expect(phases(first)).toEqual({ a: 'steady', b: 'steady' });
    expect(first.rendered.every((e) => e.delay === 0)).toBe(true);
  });

  it('animates the set after the first one', () => {
    const first = reconcileMarkers(initialMarkerState([]), [listing('a')]);
    const second = reconcileMarkers(first, [listing('a'), listing('b')]);

    expect(phases(second)).toEqual({ a: 'steady', b: 'entering' });
  });

  it('stays unseeded while the map has no markers at all', () => {
    // A viewport that legitimately holds no homes must not burn the free pass —
    // the first pins the user actually sees are still the first ones.
    const empty = reconcileMarkers(initialMarkerState([]), []);
    expect(empty.seeded).toBe(false);

    const firstReal = reconcileMarkers(empty, [listing('a')]);
    expect(phases(firstReal)).toEqual({ a: 'steady' });
  });

  it('does not restart an entrance that is still running', () => {
    // Re-rendering for an unrelated reason (a pin recolouring as viewed) must
    // not send a mid-jump marker back to the start.
    const first = reconcileMarkers(seeded(['a']), [listing('b')]);
    expect(phases(first)).toEqual({ a: 'leaving', b: 'entering' });

    const again = reconcileMarkers(first, [listing('b')]);
    expect(again.rendered.find((e) => e.listing.id === 'b')!.phase).toBe('entering');
    expect(again.rendered.find((e) => e.listing.id === 'b')!.delay).toBe(
      first.rendered.find((e) => e.listing.id === 'b')!.delay,
    );
  });

  it('takes the newer listing for a marker that is staying', () => {
    // Price and viewed state change under a stable id; the pin must redraw.
    const before = seeded(['a']);
    const repriced = { ...listing('a'), price: 999_000 };

    const next = reconcileMarkers(before, [repriced]);

    expect(next.rendered[0]!.listing.price).toBe(999_000);
    expect(next.rendered[0]!.phase).toBe('steady');
  });

  it('lets a marker that comes back re-enter rather than resume dying', () => {
    const leaving = reconcileMarkers(seeded(['a']), []);
    expect(phases(leaving)).toEqual({ a: 'leaving' });

    const returned = reconcileMarkers(leaving, [listing('a')]);

    // One entry, not a live pin plus its own ghost.
    expect(returned.rendered).toHaveLength(1);
    expect(returned.rendered[0]!.phase).toBe('entering');
  });

  it('holds earlier departures while a second wave starts leaving', () => {
    const first = reconcileMarkers(seeded(['a', 'b']), [listing('b')]);
    expect(phases(first)).toEqual({ a: 'leaving', b: 'steady' });

    const second = reconcileMarkers(first, []);

    // 'a' is still fading and must not be dropped a frame early just because
    // 'b' has now started too.
    expect(phases(second)).toEqual({ a: 'leaving', b: 'leaving' });
  });
});
