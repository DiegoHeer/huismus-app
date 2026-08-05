import type { MultiPolygon, Polygon, Position } from 'geojson';

/**
 * Geometric primitives shared by the map's two hit tests: `city-hit-test.ts`
 * (which municipality holds a tapped point) and `area-hit-test.ts` (which
 * neighborhood does). Both answer the same question against the same GeoJSON
 * shapes, so the ray-casting lives here once.
 */

/** Axis-aligned bounds in WGS84 degrees: [minLng, minLat, maxLng, maxLat]. */
export type Bounds = [number, number, number, number];

/** A geometry's polygons as a flat list (Polygon → 1, MultiPolygon → many). */
export function polygonsOf(geometry: Polygon | MultiPolygon): Position[][][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

/** Bounding box of a geometry, scanned from its outer rings. */
export function boundsOf(geometry: Polygon | MultiPolygon): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rings of polygonsOf(geometry)) {
    // The outer ring (index 0) bounds the polygon; holes sit inside it.
    for (const [x, y] of rings[0]!) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

/** Cheap rejection test: is the point inside a precomputed bounding box? */
export function inBounds(x: number, y: number, bbox: Bounds): boolean {
  const [minX, minY, maxX, maxY] = bbox;
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

/** Standard ray-casting test for a point against a single linear ring. */
function pointInRing(x: number, y: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Inside a polygon = inside its outer ring and outside every hole. */
function pointInPolygon(x: number, y: number, rings: Position[][]): boolean {
  if (rings.length === 0 || !pointInRing(x, y, rings[0]!)) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(x, y, rings[i]!)) return false; // landed in a hole
  }
  return true;
}

/**
 * Is `[x, y]` inside the geometry? A MultiPolygon counts as a hit when any of
 * its parts contains the point.
 */
export function pointInGeometry(x: number, y: number, geometry: Polygon | MultiPolygon): boolean {
  return polygonsOf(geometry).some((rings) => pointInPolygon(x, y, rings));
}
