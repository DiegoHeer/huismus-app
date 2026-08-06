import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { useMemo } from 'react';

import { useResolvedScheme } from '@/hooks/use-theme';
import { useMapSettings, type BasemapFamily } from '@/lib/map-settings';

import darkStyle from './dark-style.json';
import lightStyle from './positron-style.json';
import { warmBasemap } from './warm-basemap';

// Light: OpenMapTiles Positron, vendored to `positron-style.json` from
// OpenFreeMap (its sources/sprite/glyphs are already keyless) and recolored —
// greenery (parks, woods) to #c4e0c9 and water (sea/lake fills + river lines)
// to #cee0e5. Vendored rather than referenced by URL so those colors can be
// edited. https://github.com/openmaptiles/positron-gl-style
export const MAP_STYLE_LIGHT = lightStyle as unknown as StyleSpecification;

// Dark: OpenFreeMap's "dark" (dark-matter) style, vendored to `dark-style.json`
// and brightened — every color's HSL lightness is gamma-lifted (L**0.6) so the
// near-black base tones become legible dark grays while the light labels stay
// put. Greenery and water are then rendered exactly like the light theme: the
// same colors (greenery #c4e0c9, water/rivers #c0dce3) and the same layer setup
// — a `park` source-layer fill drawn *under* water (so parks never bleed green
// over it), plus a plain green wood fill (no pattern). dark-matter natively
// lacks the `park` fill and patterns its woods, so those are added/changed here
// to match positron.
export const MAP_STYLE_DARK = darkStyle as unknown as StyleSpecification;

// `beforeId` for the polygon overlays — the layer they insert *below*. In both
// vendored basemaps the `building` fill sits just under the first label layer,
// above every road and boundary line. Inserting the overlays beneath it puts
// the colored tiles above all roads and base fills, yet below the buildings and
// every text label. (dark-matter ships this order; positron's `building` was
// moved up from its stock spot beneath the roads to match — see
// positron-style.json.)
const POLYGONS_BEFORE = 'building';

// `beforeId` for the data overlays (WMS rasters, BAG building fills) — the
// first layer *above* `building` in each vendored style. Unlike the choropleth
// they must cover the basemap's building fills (they re-paint footprints or
// wash over the whole map), yet still sit below every label.
const OVERLAY_BEFORE_LIGHT = 'waterway_line_label';
const OVERLAY_BEFORE_DARK = 'highway_name_other';

// Liberty — the detailed OpenMapTiles style huismus-web's landing map uses
// (src/islands/TeaserMap.tsx). Referenced by URL rather than vendored, so the
// app and the site can never drift apart on it; its tiles already come from
// OpenFreeMap, so this adds no new host. Keyless and production-permitted.
//
// Liberty is a light style and OpenFreeMap ships no dark counterpart that
// resembles it (its dark siblings are dark-matter and fiord, which look nothing
// alike), so this family stays light in both themes — picking it is a deliberate
// "I want the detailed map" choice. Both `beforeId` anchors below exist in it:
// `building` at index 83 and `waterway_line_label` at 88, in that order.
const MAP_STYLE_LIBERTY = 'https://tiles.openfreemap.org/styles/liberty';

export interface MapStyleConfig {
  /** Style URL (light) or inline spec (dark) to pass to the Map's `mapStyle`. */
  mapStyle: string | StyleSpecification;
  /** `beforeId` for the polygon layers, matching the active basemap. */
  polygonsBeforeId: string;
  /** `beforeId` for the data overlays — above buildings, below labels. */
  overlayBeforeId: string;
  /** The resolved theme, so callers can pick theme-aware overlay colors. */
  scheme: 'light' | 'dark';
}

/**
 * The app's effective theme. Re-exported under its original name for the map's
 * many callers; {@link useResolvedScheme} is the definition, shared with the
 * rest of the app's JS-computed colors (see hooks/use-theme.ts).
 */
export const useEffectiveColorScheme = useResolvedScheme;

/**
 * Resolve a basemap family + theme to a concrete style.
 *
 * A family is a light/dark *pair*, not a single style: the appearance setting
 * still picks the variant within it, so a dark app never opens onto a blinding
 * light map. Liberty is the documented exception — see MAP_STYLE_LIBERTY.
 *
 * Split out of the hook so it can be exercised directly in tests.
 */
export function basemapFor(family: BasemapFamily, scheme: 'light' | 'dark'): MapStyleConfig {
  const base = scheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
  const overlayBeforeId = scheme === 'dark' ? OVERLAY_BEFORE_DARK : OVERLAY_BEFORE_LIGHT;
  const shared = { polygonsBeforeId: POLYGONS_BEFORE, scheme };

  if (family === 'liberty') {
    // Always the light spec's anchors — Liberty is light in both themes, and
    // OVERLAY_BEFORE_DARK ('highway_name_other') does not exist in it, which
    // would throw when the overlay layers are inserted.
    return { ...shared, mapStyle: MAP_STYLE_LIBERTY, overlayBeforeId: OVERLAY_BEFORE_LIGHT };
  }
  if (family === 'warm') {
    return { ...shared, mapStyle: warmBasemap(base, scheme), overlayBeforeId };
  }
  return { ...shared, mapStyle: base, overlayBeforeId };
}

/**
 * Drop a `beforeId` the loaded style doesn't actually have.
 *
 * MapLibre throws outright when `beforeId` names a missing layer, which takes
 * the whole map down rather than just mis-ordering one overlay. For the
 * vendored specs `basemap.test.ts` proves the anchors exist, but Liberty is
 * fetched from OpenFreeMap at runtime — the point of referencing it by URL is
 * that it tracks upstream, so its layer list can change without this repo
 * changing. `undefined` means "add on top", which loses the label ordering but
 * keeps the map alive.
 *
 * `layerIds` is null until the style has loaded, in which case the declared
 * anchor is passed through untouched — nothing has been added yet at that point.
 */
export function resolveAnchor(anchor: string, layerIds: Set<string> | null): string | undefined {
  if (!layerIds) return anchor;
  return layerIds.has(anchor) ? anchor : undefined;
}

/**
 * The basemap for the chosen family (Settings → Map) at the app's effective
 * theme. Also returns the resolved `scheme` so the overlay layers can match it
 * without re-deriving the theme.
 */
export function useMapStyle(): MapStyleConfig {
  const scheme = useEffectiveColorScheme();
  const { basemap } = useMapSettings();
  // The warm variants are rebuilt from the vendored spec on every call, so
  // memoise: MapLibre diffs `mapStyle` by identity, and a fresh object each
  // render would tear down and re-create every layer on the map.
  return useMemo(() => basemapFor(basemap, scheme), [basemap, scheme]);
}
