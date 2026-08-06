import type { CityShape } from '@huismus/types';
import type { Position } from 'geojson';

import { boundsOf, type Bounds, inBounds, pointInGeometry } from './geo-hit-test';

/** A city plus its precomputed bounding box, so a tap can skip most polygons. */
export interface CityIndexEntry {
  code: string;
  name: string;
  bbox: Bounds;
  geometry: CityShape['geometry'];
}

/**
 * Precompute each city's bounding box once. A tap then ray-casts only the
 * polygons whose bbox contains it (usually one). Cities are loaded once and
 * cached, so this runs only when that list changes.
 */
export function buildCityIndex(cities: CityShape[]): CityIndexEntry[] {
  return cities.map((c) => ({
    code: c.code,
    name: c.name,
    bbox: boundsOf(c.geometry),
    geometry: c.geometry,
  }));
}

/**
 * The city whose shape contains the point `[lng, lat]`, or null. Cities don't
 * overlap, so the first containing shape is the answer. The cheap bbox check
 * rejects nearly every city before the heavier ray-cast runs.
 */
export function findCityAt(point: Position, index: CityIndexEntry[]): CityIndexEntry | null {
  const x = point[0]!;
  const y = point[1]!;
  for (const city of index) {
    if (!inBounds(x, y, city.bbox)) continue;
    if (pointInGeometry(x, y, city.geometry)) return city;
  }
  return null;
}
