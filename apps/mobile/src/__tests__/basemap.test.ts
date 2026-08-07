import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

import {
  basemapFor,
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
  resolveAnchor,
} from '@/components/map-style';
import { warmBasemap, WARM_DARK, WARM_LIGHT } from '@/components/warm-basemap';
import { BASEMAP_FAMILIES } from '@/lib/map-settings';

/** Every colour string reachable from a style's layer paint. */
function paintColors(style: StyleSpecification): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      if (/^(#|rgba?\(|hsla?\()/.test(v)) out.push(v.toLowerCase());
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  for (const layer of style.layers) walk((layer as { paint?: unknown }).paint);
  return out;
}

function layerPaint(style: StyleSpecification, id: string): Record<string, unknown> {
  const layer = style.layers.find((l) => l.id === id);
  if (!layer) throw new Error(`no layer ${id}`);
  return ((layer as { paint?: Record<string, unknown> }).paint ?? {}) as Record<string, unknown>;
}

describe('warmBasemap', () => {
  it('re-tones the ground, greenery and water away from the stock greys', () => {
    const warm = warmBasemap(MAP_STYLE_LIGHT, 'light');
    expect(layerPaint(warm, 'background')['background-color']).toBe('#F4EDE3');
    expect(layerPaint(warm, 'park')['fill-color']).toBe('#D9E0C7');
    expect(layerPaint(warm, 'water')['fill-color']).toBe('#C7D5DA');
  });

  it('steps the same roles down for the dark ground', () => {
    const warm = warmBasemap(MAP_STYLE_DARK, 'dark');
    expect(layerPaint(warm, 'background')['background-color']).toBe('#1C1611');
    expect(layerPaint(warm, 'water')['fill-color']).toBe('#1F2B31');
  });

  it('gives a symbol layer its label colour and its halo separately', () => {
    const warm = warmBasemap(MAP_STYLE_LIGHT, 'light');
    const paint = layerPaint(warm, 'label_city');
    expect(paint['text-color']).toBe('#2A231C');
    expect(paint['text-halo-color']).toBe('rgba(250,246,240,0.85)');
  });

  it('rewrites colours buried inside a zoom expression', () => {
    // `highway_motorway_inner` carries its colour inside an
    // ["interpolate", ["linear"], ["zoom"], 5.8, "…", 6, "…"] expression — a
    // rewrite that only walked plain strings would silently skip it.
    const raw = layerPaint(MAP_STYLE_LIGHT, 'highway_motorway_inner')['line-color'];
    expect(Array.isArray(raw)).toBe(true);

    const warm = warmBasemap(MAP_STYLE_LIGHT, 'light');
    const expr = layerPaint(warm, 'highway_motorway_inner')['line-color'] as unknown[];
    expect(expr[0]).toBe('interpolate'); // operators survive untouched
    const colors = expr.filter((v) => typeof v === 'string' && /^(#|rgba?\(|hsla?\()/.test(v));
    expect(colors.length).toBeGreaterThan(0);
    expect(new Set(colors)).toEqual(new Set([WARM_LIGHT.road]));
  });

  it('emits only palette colours (or a warm-shifted fallback)', () => {
    for (const [style, scheme, palette] of [
      [MAP_STYLE_LIGHT, 'light', WARM_LIGHT],
      [MAP_STYLE_DARK, 'dark', WARM_DARK],
    ] as const) {
      const allowed = new Set(Object.values(palette).map((c) => c.toLowerCase()));
      const stray = [...new Set(paintColors(warmBasemap(style, scheme)))].filter(
        // The unmatched-layer fallback emits `rgb(…)` / `rgba(…)` triples.
        (c) => !allowed.has(c) && !/^rgba?\(\d/.test(c),
      );
      expect(stray).toEqual([]);
    }
  });

  it('does not mutate the vendored spec', () => {
    // The JSON imports are module singletons shared with the Standard family;
    // mutating one would poison the other.
    const snapshot = JSON.stringify(MAP_STYLE_LIGHT);
    warmBasemap(MAP_STYLE_LIGHT, 'light');
    warmBasemap(MAP_STYLE_LIGHT, 'dark');
    expect(JSON.stringify(MAP_STYLE_LIGHT)).toBe(snapshot);
  });

  it('keeps every layer, its id and its type', () => {
    const warm = warmBasemap(MAP_STYLE_LIGHT, 'light');
    expect(warm.layers.map((l) => [l.id, l.type])).toEqual(
      MAP_STYLE_LIGHT.layers.map((l) => [l.id, l.type]),
    );
  });
});

describe('basemapFor', () => {
  it('pairs each family with the variant for the active theme', () => {
    expect(basemapFor('standard', 'light').mapStyle).toBe(MAP_STYLE_LIGHT);
    expect(basemapFor('standard', 'dark').mapStyle).toBe(MAP_STYLE_DARK);
  });

  it('serves Liberty by URL, light in both themes', () => {
    const url = 'https://tiles.openfreemap.org/styles/liberty';
    expect(basemapFor('liberty', 'light').mapStyle).toBe(url);
    expect(basemapFor('liberty', 'dark').mapStyle).toBe(url);
  });

  it('keeps Liberty on the light overlay anchor even in dark mode', () => {
    // 'highway_name_other' — the dark spec's anchor — does not exist in Liberty,
    // and MapLibre throws when a `beforeId` names a missing layer.
    expect(basemapFor('liberty', 'dark').overlayBeforeId).toBe('waterway_line_label');
  });

  it('gives every family both overlay anchors and reports the resolved scheme', () => {
    for (const family of BASEMAP_FAMILIES) {
      for (const scheme of ['light', 'dark'] as const) {
        const config = basemapFor(family, scheme);
        expect(config.polygonsBeforeId).toBe('building');
        expect(config.overlayBeforeId).toBeTruthy();
        expect(config.scheme).toBe(scheme);
      }
    }
  });

  it('cannot verify Liberty, which is why resolveAnchor exists', () => {
    // Liberty is a URL, so there is no local spec to inspect — the test below
    // covers only the families whose layer list ships in this repo. What
    // protects Liberty at runtime is resolveAnchor, not this assertion.
    expect(typeof basemapFor('liberty', 'light').mapStyle).toBe('string');
  });

  it('anchors the polygon overlays on a layer the style actually has', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const family of ['standard', 'warm'] as const) {
        const { mapStyle, polygonsBeforeId, overlayBeforeId } = basemapFor(family, scheme);
        const ids = (mapStyle as StyleSpecification).layers.map((l) => l.id);
        expect(ids).toContain(polygonsBeforeId);
        expect(ids).toContain(overlayBeforeId);
        // The data overlays must sit above the buildings they re-paint.
        expect(ids.indexOf(overlayBeforeId)).toBeGreaterThan(ids.indexOf(polygonsBeforeId));
      }
    }
  });
});

describe('resolveAnchor', () => {
  it('keeps an anchor the loaded style has', () => {
    expect(resolveAnchor('building', new Set(['water', 'building']))).toBe('building');
  });

  it('drops one it does not, so MapLibre appends instead of throwing', () => {
    // A `beforeId` naming a missing layer is a hard throw that takes the map
    // down; undefined only loses the ordering. Liberty is fetched from
    // OpenFreeMap, so its layer list can change without this repo changing.
    expect(resolveAnchor('highway_name_other', new Set(['water', 'building']))).toBeUndefined();
  });

  it('passes the anchor through before the style has loaded', () => {
    // Nothing has been added to the map yet at that point, so there is nothing
    // to throw; the real check happens on the styledata that follows.
    expect(resolveAnchor('building', null)).toBe('building');
  });
});
