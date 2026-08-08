import type { FillExtrusionLayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Listing, MapBounds } from '@huismus/types';

/** Fallback map centre (Amsterdam) when there are no polygons or listings to frame. */
export const DEFAULT_CENTER = { longitude: 4.9041, latitude: 52.3676 } as const;

/**
 * Zoom the map opens at — roughly a province in view. Shared by both platforms'
 * `initialViewState` and by the framing they report before the first gesture, so
 * the reported zoom can't drift from the one actually applied.
 */
export const INITIAL_ZOOM = 11;

/**
 * Widen MapLibre's `[west, south, east, north]` bounds tuple (the shape the
 * native region-change event reports) into the named form the listings query
 * takes. The web map reports bounds as an object instead, so it converts inline.
 */
export function boundsFromTuple(
  [west, south, east, north]: readonly [number, number, number, number],
): MapBounds {
  return { west, south, east, north };
}

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
 * Fill for an already-viewed listing's pin — a warm taupe against the brand red
 * of an unseen one. A solid colour rather than the brand accent at reduced
 * alpha: a translucent pin picks up whatever tile happens to sit behind it, so
 * "seen" looked like a different shade on every basemap, and over busy ground it
 * read as a rendering glitch rather than a state.
 *
 * Two values because one cannot carry the white label on both basemaps. The
 * light one is `Colors.light.textSecondary`, the palette's own "supporting"
 * ink, which is exactly the meaning wanted. Its dark counterpart (#A99C8C) is
 * too pale for white text (2.7:1), so the dark map gets a deeper taupe of the
 * same family: 5.1:1, and light enough to stay visible on a dark basemap.
 *
 * These are map chrome, not brand tokens — `constants/theme.ts` is kept
 * value-for-value in sync with huismus-web's tokens.css, so nothing new belongs
 * there. Shared here so the native and web markers can't drift.
 */
export const VIEWED_PIN_FILL = {
  light: '#6F6354',
  dark: '#7A6C5B',
} as const;

/** {@link VIEWED_PIN_FILL} for the basemap currently showing. */
export function viewedPinFill(scheme: 'light' | 'dark'): string {
  return VIEWED_PIN_FILL[scheme];
}

/**
 * Geometry of the pin's tail — the downward triangle under the price bubble.
 *
 * The triangle is the usual trick of a box with two transparent side borders
 * and one coloured top one, which gives a shape but no stroke of its own. So the
 * tail is drawn twice: a white triangle a little larger, and the fill on top of
 * it, leaving {@link PIN_TAIL.border} of white showing along both slopes — the
 * bubble's 1px outline carried on around the point.
 *
 * The outline is deliberately wider than 1: it is measured perpendicular to a
 * slope, and these slopes are steep, so a 1px horizontal inset would read as
 * about 0.8px. Shared so the native and web markers can't drift.
 */
export const PIN_TAIL = {
  /** Half the fill triangle's width, i.e. one side border. */
  halfWidth: 5,
  /** The fill triangle's height, i.e. its top border. */
  height: 6,
  /** How far the white triangle extends past the fill on every side. */
  border: 1.5,
} as const;

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
