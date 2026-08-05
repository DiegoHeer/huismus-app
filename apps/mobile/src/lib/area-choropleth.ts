import type { AreaPolygon, NeighborhoodStats } from '@huismus/types';

import { RAW_FIELDS } from './neighborhood-stats';

/**
 * Choropleth coloring for the neighborhood overlays: each polygon's fill is
 * shaded by a statistic (number of inhabitants, for now) relative to the other
 * neighborhoods of the SAME municipality. The app loads one municipality's
 * areas at a time (e.g. Den Haag `0518`), so the comparison set is just the
 * areas passed in — the min→max is taken across them.
 *
 * Light theme: few inhabitants → pale warm tint, many → deep brand red, so the
 * busier neighborhoods read as "heavier" on the light basemap. Dark theme
 * inverts the lightness (few → deep near-background red, many → bright coral) so
 * the busier areas still stand out against a dark map. Swapping the statistic
 * later is a one-liner: pass a different {@link AreaStatSelector}.
 */

export type ChoroplethScheme = 'light' | 'dark';

/**
 * Sequential ramps on the brand hue, ordered low→high value. The light ramp runs
 * pale warm tint → deep red; the dark ramp runs deep → bright coral, so "more"
 * is always the more prominent end on its own basemap. Stops are sampled
 * continuously, so the gradient is smooth.
 *
 * This is a continuous encoding, not a set of discrete tiers, so the pale end is
 * allowed to recede toward the basemap — "near zero" reading as "nearly nothing"
 * is the point. (The discrete ramps in components/area-stats.tsx are held to a
 * stricter floor for exactly that reason.)
 */
const RAMP_LIGHT = ['#fbeae2', '#f3c6b2', '#e58c6e', '#ce4c30', '#8a2a19'];
const RAMP_DARK = ['#3b160e', '#7a2a1a', '#c0402a', '#e8785e', '#f6c0ac'];

/** Neutral fill for neighborhoods whose statistic CBS suppressed (no data). */
const NO_DATA_LIGHT = '#dbcfc0';
const NO_DATA_DARK = '#4a3d31';

/**
 * One consistent, legible outline for every overlay — the fill alone encodes
 * the value, so the boundary stays visible even where the fill is near-white
 * (light theme) or near-background (dark theme).
 */
const OUTLINE_LIGHT = '#8a2a19';
const OUTLINE_DARK = '#f6c0ac';

/** Outline color for the area overlays, matching the active basemap theme. */
export function outlineColorFor(scheme: ChoroplethScheme): string {
  return scheme === 'dark' ? OUTLINE_DARK : OUTLINE_LIGHT;
}

/** Read a finite number, treating `null`/missing/`NaN` as absent. */
function numOrNull(v: number | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Pulls the statistic to shade by out of a neighborhood's raw CBS record. */
export type AreaStatSelector = (stats: NeighborhoodStats) => number | null;

/** Default statistic: number of inhabitants (CBS `AantalInwoners`). */
export const selectInhabitants: AreaStatSelector = (stats) =>
  numOrNull(stats.stats[RAW_FIELDS.inhabitants]);

/** Parse `#rrggbb` into an `[r, g, b]` triple (0–255). */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (n: number): string => Math.round(n).toString(16).padStart(2, '0');

/**
 * Sample a multi-stop ramp at `t` ∈ [0, 1] with piecewise-linear RGB blending.
 * `t` is clamped, so out-of-range inputs saturate at the ramp's ends.
 */
export function interpolateRamp(stops: string[], t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const lastStop = stops.length - 1;
  const pos = clamped * lastStop;
  const i = Math.min(lastStop - 1, Math.floor(pos));
  const f = pos - i;
  const [r1, g1, b1] = hexToRgb(stops[i]!);
  const [r2, g2, b2] = hexToRgb(stops[i + 1]!);
  return `#${toHex(r1 + (r2 - r1) * f)}${toHex(g1 + (g2 - g1) * f)}${toHex(b1 + (b2 - b1) * f)}`;
}

export interface ChoroplethOptions {
  /** Active basemap theme — selects the ramp + no-data color. */
  scheme: ChoroplethScheme;
  /** Which statistic to shade by. Defaults to {@link selectInhabitants}. */
  selectValue?: AreaStatSelector;
}

/** The sequential blue ramp (low→high value) for the given basemap theme. */
export function rampFor(scheme: ChoroplethScheme): string[] {
  return scheme === 'dark' ? RAMP_DARK : RAMP_LIGHT;
}

/** Resolve each area's statistic in order; missing entry/suppressed value → null. */
function resolveValues(
  areas: AreaPolygon[],
  statsByCode: Map<string, NeighborhoodStats>,
  selectValue: AreaStatSelector,
): (number | null)[] {
  return areas.map((area) => {
    const stats = statsByCode.get(area.id);
    return stats ? selectValue(stats) : null;
  });
}

/** Min/max across the present (non-null) values, or null when there are none. */
function domainOf(values: (number | null)[]): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v == null) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return Number.isFinite(min) ? { min, max } : null;
}

/**
 * The value range the choropleth spans across `areas` (one municipality) for the
 * chosen statistic — the same min→max {@link colorAreasByStat} shades against, so
 * a legend built from it lines up with the map fill. Returns null when there's no
 * spread to plot: no data, a single area, or every area equal.
 */
export function statDomain(
  areas: AreaPolygon[],
  statsByCode: Map<string, NeighborhoodStats>,
  selectValue: AreaStatSelector = selectInhabitants,
): { min: number; max: number } | null {
  const domain = domainOf(resolveValues(areas, statsByCode, selectValue));
  return domain && domain.max > domain.min ? domain : null;
}

/**
 * Return the areas with their `color` replaced by a choropleth fill: each
 * polygon shaded by its statistic relative to the min/max across the passed set
 * (one municipality). Areas with no matching stats entry, or a suppressed
 * value, get the neutral no-data color. Geometry, `id` and `name` are preserved.
 * Pure — the map renders the result unchanged via `["get", "color"]`.
 */
export function colorAreasByStat(
  areas: AreaPolygon[],
  statsByCode: Map<string, NeighborhoodStats>,
  { scheme, selectValue = selectInhabitants }: ChoroplethOptions,
): AreaPolygon[] {
  const ramp = rampFor(scheme);
  const noData = scheme === 'dark' ? NO_DATA_DARK : NO_DATA_LIGHT;

  // Resolve every area's value up front so min/max span the whole municipality.
  const values = resolveValues(areas, statsByCode, selectValue);
  const domain = domainOf(values);
  const span = domain ? domain.max - domain.min : 0;

  return areas.map((area, i) => {
    const v = values[i];
    if (v == null) return { ...area, color: noData };
    // A single value (or all-equal municipality) has no spread to show — sit at
    // the middle of the ramp rather than implying an extreme.
    const t = span > 0 && domain ? (v - domain.min) / span : 0.5;
    return { ...area, color: interpolateRamp(ramp, t) };
  });
}
