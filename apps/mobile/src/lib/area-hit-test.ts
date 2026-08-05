import type { AreaPolygon } from '@huismus/types';
import type { Position } from 'geojson';

import { boundsOf, type Bounds, inBounds, pointInGeometry } from './geo-hit-test';

/**
 * Which neighborhood overlay a tap landed on, decided from the tap's geographic
 * coordinate rather than from the native map's hit-test result.
 *
 * MapLibre's native press event does not report the feature under the finger: it
 * queries a fixed 44×44 pt/dp hitbox *rect* centred on the touch (iOS
 * `MLRNSource` and Android `MLRNPressableSource` both default to 22 on each
 * side) and returns every feature intersecting it, unordered — render order,
 * not distance from the touch. Buurten tessellate, so any tap near a shared
 * border matches several, and taking `features[0]` picks an arbitrary one. The
 * further out the camera is zoomed, the more neighborhoods fit inside those
 * 44 pt and the more often it picks a wrong — visibly offset — one.
 *
 * The same event carries the exact tapped coordinate, so we ray-cast that
 * against our own (unsimplified, untiled) geometry instead. Web needs none of
 * this: MapLibre GL JS queries `interactiveLayerIds` at the exact click point.
 */

/** A neighborhood plus its precomputed bounding box, mirroring `CityIndexEntry`. */
export interface AreaIndexEntry {
  id: string;
  bbox: Bounds;
  geometry: AreaPolygon['geometry'];
}

/**
 * Precompute each neighborhood's bounding box so a tap ray-casts only the
 * shapes whose box contains it. A municipality has a few hundred neighborhoods
 * at most, and the list changes only when the city (or its choropleth coloring)
 * does, so the caller should memoize this.
 */
export function buildAreaIndex(polygons: AreaPolygon[]): AreaIndexEntry[] {
  return polygons.map((p) => ({ id: p.id, bbox: boundsOf(p.geometry), geometry: p.geometry }));
}

/**
 * Id of the neighborhood whose shape contains the point `[lng, lat]`, or null
 * when the point falls outside all of them — which the caller should treat as a
 * press on the bare map (the city hit test), exactly as web does.
 *
 * Neighborhoods don't overlap, so the first containing shape is the answer.
 */
export function findAreaAt(point: Position, index: AreaIndexEntry[]): string | null {
  const x = point[0]!;
  const y = point[1]!;
  for (const area of index) {
    if (!inBounds(x, y, area.bbox)) continue;
    if (pointInGeometry(x, y, area.geometry)) return area.id;
  }
  return null;
}
