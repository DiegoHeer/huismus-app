import type { MapBounds } from '@huismus/types';

/**
 * Turning the map's visible bounds straight into a query key would refetch on
 * every pixel of pan — each gesture ends on a slightly different rectangle, so
 * no two viewports would ever share a cache entry. These helpers widen and snap
 * the viewport to a coarse grid instead: nudging the map re-uses the previous
 * key (a cache hit, no request), while a real move lands on a new cell.
 */

/**
 * Fraction of the viewport span fetched beyond each edge. Markers therefore
 * exist slightly off screen, so a short drag reveals pins already loaded rather
 * than empty space waiting on a request.
 */
const EDGE_PADDING = 0.25;

/** Roughly how many grid cells span the padded viewport. */
const GRID_DIVISIONS = 4;

/** Latitude limit; Web Mercator can report bounds past the pole when zoomed out. */
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

function clamp(value: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, value));
}

/**
 * Grid size for a span, as the leading digit of `span / GRID_DIVISIONS` at its
 * own magnitude (…, 0.01, 0.02, 0.05→5×0.01, 0.1, 0.2, …). Quantizing the step
 * itself is what makes the grid stable: two nearby zoom levels round to the same
 * step, so they also share cache cells.
 */
function snapStep(span: number): number {
  if (!(span > 0)) return 0.01;
  const raw = span / GRID_DIVISIONS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return magnitude * Math.max(1, Math.round(raw / magnitude));
}

/**
 * Widen `bounds` by {@link EDGE_PADDING} and snap each edge outward onto a grid.
 * Snapping outward is what keeps the result a superset of what the user can see:
 * the fetched region always covers the viewport, never crops it.
 */
export function quantizeBounds(bounds: MapBounds): MapBounds {
  const lonSpan = bounds.east - bounds.west;
  const latSpan = bounds.north - bounds.south;

  // A world-spanning viewport has nothing left to snap to, and wrapping past the
  // antimeridian would make `west > east` — an empty rectangle server-side.
  if (lonSpan <= 0 || lonSpan >= 2 * MAX_LONGITUDE) {
    return { west: -MAX_LONGITUDE, south: -MAX_LATITUDE, east: MAX_LONGITUDE, north: MAX_LATITUDE };
  }

  const lonStep = snapStep(lonSpan);
  const latStep = snapStep(latSpan);

  return {
    west: clamp(Math.floor((bounds.west - lonSpan * EDGE_PADDING) / lonStep) * lonStep, MAX_LONGITUDE),
    east: clamp(Math.ceil((bounds.east + lonSpan * EDGE_PADDING) / lonStep) * lonStep, MAX_LONGITUDE),
    south: clamp(Math.floor((bounds.south - latSpan * EDGE_PADDING) / latStep) * latStep, MAX_LATITUDE),
    north: clamp(Math.ceil((bounds.north + latSpan * EDGE_PADDING) / latStep) * latStep, MAX_LATITUDE),
  };
}

/** True when both rectangles are the same, treating null as "no viewport yet". */
export function boundsEqual(a: MapBounds | null, b: MapBounds | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.west === b.west && a.south === b.south && a.east === b.east && a.north === b.north;
}
