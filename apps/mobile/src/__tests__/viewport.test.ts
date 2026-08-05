import type { MapBounds } from '@huismus/types';

import { boundsEqual, quantizeBounds } from '@/lib/viewport';

// The map turns its visible bounds into the residence query's bbox. Quantizing
// them is what stops every pixel of pan from becoming a new query key (and so a
// new request), while still never cropping what the user can see.

/** Amsterdam-ish viewport, ~0.3° x 0.13°. */
const AMSTERDAM: MapBounds = { west: 4.75, south: 52.3, east: 5.05, north: 52.43 };

/** True when `outer` fully contains `inner`. */
function contains(outer: MapBounds, inner: MapBounds): boolean {
  return (
    outer.west <= inner.west &&
    outer.south <= inner.south &&
    outer.east >= inner.east &&
    outer.north >= inner.north
  );
}

describe('quantizeBounds', () => {
  it('never crops the visible viewport', () => {
    const q = quantizeBounds(AMSTERDAM);
    expect(contains(q, AMSTERDAM)).toBe(true);
  });

  it('fetches beyond the edges, so a short drag reveals loaded markers', () => {
    const q = quantizeBounds(AMSTERDAM);
    expect(q.west).toBeLessThan(AMSTERDAM.west);
    expect(q.east).toBeGreaterThan(AMSTERDAM.east);
    expect(q.south).toBeLessThan(AMSTERDAM.south);
    expect(q.north).toBeGreaterThan(AMSTERDAM.north);
  });

  it('maps a small nudge onto the same rectangle', () => {
    // A pan of ~0.001° — a few pixels at city zoom — must be a cache hit.
    const nudged: MapBounds = {
      west: AMSTERDAM.west + 0.001,
      south: AMSTERDAM.south + 0.001,
      east: AMSTERDAM.east + 0.001,
      north: AMSTERDAM.north + 0.001,
    };
    expect(quantizeBounds(nudged)).toEqual(quantizeBounds(AMSTERDAM));
  });

  it('maps a real pan onto a different rectangle', () => {
    // Panning by most of the viewport width must actually refetch.
    const moved: MapBounds = {
      west: AMSTERDAM.west + 0.3,
      south: AMSTERDAM.south,
      east: AMSTERDAM.east + 0.3,
      north: AMSTERDAM.north,
    };
    expect(quantizeBounds(moved)).not.toEqual(quantizeBounds(AMSTERDAM));
  });

  it('maps a zoom change onto a different rectangle', () => {
    // Zooming in halves the span around the same centre.
    const zoomedIn: MapBounds = { west: 4.825, south: 52.3325, east: 4.975, north: 52.3975 };
    expect(quantizeBounds(zoomedIn)).not.toEqual(quantizeBounds(AMSTERDAM));
    expect(contains(quantizeBounds(zoomedIn), zoomedIn)).toBe(true);
  });

  it('keeps the result inside valid lon/lat range', () => {
    // Zoomed out over the pole/antimeridian, padding would otherwise overshoot
    // and the API rejects out-of-range values with a 422.
    const q = quantizeBounds({ west: -179, south: -89, east: 179, north: 89 });
    expect(q.west).toBeGreaterThanOrEqual(-180);
    expect(q.east).toBeLessThanOrEqual(180);
    expect(q.south).toBeGreaterThanOrEqual(-90);
    expect(q.north).toBeLessThanOrEqual(90);
  });

  it('returns the whole world for a world-spanning viewport', () => {
    // Wrapping past the antimeridian would leave west > east — an empty
    // rectangle server-side, i.e. a map with no markers at all.
    expect(quantizeBounds({ west: -200, south: -80, east: 200, north: 80 })).toEqual({
      west: -180,
      south: -90,
      east: 180,
      north: 90,
    });
  });

  it('survives a degenerate zero-span viewport', () => {
    // Reported briefly on some platforms before the map has laid out.
    const q = quantizeBounds({ west: 4.9, south: 52.37, east: 4.9, north: 52.37 });
    expect(Number.isFinite(q.west)).toBe(true);
    expect(Number.isFinite(q.north)).toBe(true);
  });
});

describe('boundsEqual', () => {
  it('treats identical rectangles as equal', () => {
    expect(boundsEqual({ ...AMSTERDAM }, { ...AMSTERDAM })).toBe(true);
  });

  it('treats a moved edge as different', () => {
    expect(boundsEqual(AMSTERDAM, { ...AMSTERDAM, north: 52.44 })).toBe(false);
  });

  it('handles the no-viewport-yet null', () => {
    expect(boundsEqual(null, null)).toBe(true);
    expect(boundsEqual(null, AMSTERDAM)).toBe(false);
    expect(boundsEqual(AMSTERDAM, null)).toBe(false);
  });
});
