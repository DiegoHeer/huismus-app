import type { FillExtrusionLayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Listing } from '@huismus/types';

/** Fallback map centre (Amsterdam) when there are no polygons or listings to frame. */
export const DEFAULT_CENTER = { longitude: 4.9041, latitude: 52.3676 } as const;

/**
 * Below this zoom, individual buildings are too small for extrusion to read.
 * Note that 3D buildings never tilt the camera: the extrusion is drawn
 * top-down at pitch 0, and only the user's own gesture may tilt the map.
 */
export const BUILDINGS_3D_MIN_ZOOM = 15;

/**
 * `fill-extrusion` paint for the basemap's OpenMapTiles `building` layer. Both
 * vendored styles carry `render_height`/`render_min_height` on that layer (the
 * schema's precomputed extrusion fields), so no extra source is needed — see
 * `POLYGONS_BEFORE` in `map-style.ts` for the layer this sits alongside.
 */
export function buildings3DPaint(scheme: 'light' | 'dark'): FillExtrusionLayerSpecification['paint'] {
  return {
    // A step up from the warm basemap's flat `building` fill, so the extrusion
    // reads as the same buildings lifted rather than as a different layer.
    'fill-extrusion-color': scheme === 'dark' ? '#4A3B2C' : '#E0D2BE',
    'fill-extrusion-height': ['get', 'render_height'],
    'fill-extrusion-base': ['get', 'render_min_height'],
    'fill-extrusion-opacity': 0.85,
  };
}

/**
 * How far an already-viewed listing's pin fades. Blue had a pale second shade
 * for this; red has no equally obvious pale twin, so the "seen" read is carried
 * by alpha on the fill instead.
 *
 * Applied to the fill colour, never as `opacity` on the marker — see the note
 * in `listing-map.tsx`. Shared so the native and web markers can't drift.
 */
export const VIEWED_PIN_ALPHA = 0.55;

/**
 * Compact price shown inside a map marker:
 * - ≥ €1M  → millions with up to 2 decimals, e.g. 1,252,000 → "€1.25M"
 * - ≥ €1k  → thousands, e.g. 450,000 → "€450k"
 * - below  → the raw price.
 */
export function priceLabel(listing: Listing): string {
  const prefix = listing.currency === 'EUR' ? '€' : '';
  const k = Math.round(listing.price / 1000);
  // Once the rounded thousands reach 1000 ("1000k"), show millions instead.
  // Dividing by 10k then by 100 rounds to 2 decimals; Number drops any trailing
  // zeros, so 1,500,000 → "1.5M" and 1,000,000 → "1M".
  if (k >= 1000) {
    const millions = Math.round(listing.price / 10_000) / 100;
    return `${prefix}${millions}M`;
  }
  return k >= 1 ? `${prefix}${k}k` : `${listing.price}`;
}
