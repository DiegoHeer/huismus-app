import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

/**
 * The "Warm" basemap family — the vendored positron / dark-matter styles
 * re-toned to the Dageraad & Gloed palette, so the map reads as part of the app
 * rather than as a grey window cut into it.
 *
 * Done as a transform over the existing style specs rather than as two more
 * vendored JSON files: the base styles stay the single source of truth for
 * geometry, layer order and the `beforeId` anchors the overlays depend on, and
 * a future update to them flows into the warm variants for free. It also keeps
 * the actual design decision — sixteen colours — readable, instead of burying
 * it in a ~5000-line diff.
 *
 * See map-style.ts for how a family + theme resolve to a style.
 */

/** What a colour on a basemap layer is *for*. Colours are assigned by role. */
export type Role =
  | 'land'
  | 'residential'
  | 'greenery'
  | 'water'
  | 'ice'
  | 'building'
  | 'buildingOutline'
  | 'road'
  | 'roadCasing'
  | 'roadMinor'
  | 'rail'
  | 'railDash'
  | 'boundary'
  | 'label'
  | 'labelMuted'
  | 'labelHalo'
  | 'waterLabel';

/**
 * Layer id → role, first match wins. Prefix/regex rules rather than an
 * exhaustive id list so a base-style update that renames or adds a layer still
 * lands on the right role; anything genuinely unrecognised falls through to
 * {@link warmShift}, which keeps it in the family instead of leaving a stray
 * grey.
 */
const ROLES: [RegExp, Role][] = [
  [/^background$/, 'land'],
  [/^landuse_residential$/, 'residential'],
  [/^(park|landcover_wood|landcover_grass)/, 'greenery'],
  [/^(water|waterway)$/, 'water'],
  [/^landcover_(ice_shelf|glacier)$/, 'ice'],
  [/^building$/, 'building'],
  [/^road_(area_)?pier$/, 'land'],
  [/casing$/, 'roadCasing'],
  [/dashline$/, 'railDash'],
  [/^railway/, 'rail'],
  [/^boundary/, 'boundary'],
  [/(inner|bridge)$/, 'road'],
  [/^(highway|aeroway|tunnel)/, 'roadMinor'],
  [/(water_name|waterway_line_label)/, 'waterLabel'],
  [/(highway[-_]name|airport)/, 'labelMuted'],
  [/^(label|place)/, 'label'],
];

/**
 * Dageraad. Land sits between the app's `bg` and `surface` so the map reads as
 * a slightly recessed panel; water and greenery are pulled well down in
 * saturation so the only saturated thing on screen stays the pins.
 */
export const WARM_LIGHT: Record<Role, string> = {
  land: '#F4EDE3',
  residential: '#EEE5D7',
  greenery: '#D9E0C7',
  water: '#C7D5DA',
  ice: '#FBF8F3',
  building: '#E8DDCC',
  buildingOutline: '#DBCDB8',
  road: '#FFFFFF',
  roadCasing: '#E3D7C5',
  roadMinor: '#FAF5EE',
  rail: '#DDD0BD',
  railDash: '#FBF7F1',
  boundary: '#C2B29B',
  label: '#2A231C',
  labelMuted: '#6F6354',
  labelHalo: 'rgba(250,246,240,0.85)',
  waterLabel: '#5B7883',
};

/** Gloed. Same roles stepped for the dark ground — warm charcoal, not neutral black. */
export const WARM_DARK: Record<Role, string> = {
  land: '#1C1611',
  residential: '#241C15',
  greenery: '#2B3122',
  water: '#1F2B31',
  ice: '#221A14',
  building: '#2A211A',
  buildingOutline: '#3B2F24',
  road: '#4A3B2C',
  roadCasing: 'rgba(92,75,58,0.8)',
  roadMinor: '#3A2E24',
  rail: '#4E3E2F',
  railDash: '#2A211A',
  boundary: '#705B46',
  label: '#D8CCBC',
  labelMuted: '#A99C8C',
  labelHalo: 'rgba(22,17,13,0.75)',
  waterLabel: '#8AA3AD',
};

function roleFor(layerId: string, property: string): Role | null {
  // Halos are a property-level role: the same symbol layer carries both a text
  // colour and the halo punched behind it, and they sit at opposite ends.
  if (property.endsWith('-halo-color')) return 'labelHalo';
  if (property === 'fill-outline-color' && layerId === 'building') return 'buildingOutline';
  for (const [pattern, role] of ROLES) {
    if (pattern.test(layerId)) return role;
  }
  return null;
}

/** Parse `#rgb`, `#rrggbb`, `rgb[a](…)` and `hsl[a](…)` into RGB + alpha. */
function parseColor(value: string): { r: number; g: number; b: number; a: number } | null {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value.trim());
  if (hex) {
    const h = hex[1]!;
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(value.trim());
  if (rgb) {
    const parts = rgb[1]!.split(',').map((p) => Number(p.trim()));
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts[3] ?? 1 };
  }
  const hsl = /^hsla?\(([^)]+)\)$/i.exec(value.trim());
  if (hsl) {
    const parts = hsl[1]!.split(',').map((p) => Number(p.trim().replace('%', '')));
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    const [h, s, l] = [parts[0]! / 360, parts[1]! / 100, parts[2]! / 100];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t: number) => {
      const u = (t + 1) % 1;
      if (u < 1 / 6) return p + (q - p) * 6 * u;
      if (u < 1 / 2) return q;
      if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
      return p;
    };
    return {
      r: Math.round(channel(h + 1 / 3) * 255),
      g: Math.round(channel(h) * 255),
      b: Math.round(channel(h - 1 / 3) * 255),
      a: parts[3] ?? 1,
    };
  }
  return null;
}

/**
 * Fallback for a layer no rule matched: keep the colour's lightness and alpha
 * but drag it onto the palette's warm axis, so an unrecognised layer reads as
 * part of the family rather than as a grey hole in it.
 */
function warmShift(value: string, scheme: 'light' | 'dark'): string {
  const rgb = parseColor(value);
  if (!rgb) return value;
  // Rec. 601 luma — cheap, and only relative ordering matters here.
  const luma = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  const anchor = scheme === 'light' ? WARM_LIGHT.land : WARM_DARK.land;
  const base = parseColor(anchor)!;
  // Blend the anchor's hue over a neutral of the original lightness.
  const mix = (c: number) => Math.round(255 * luma * 0.75 + c * 0.25);
  const [r, g, b] = [mix(base.r), mix(base.g), mix(base.b)];
  return rgb.a === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${rgb.a})`;
}

/** Rewrite a paint value, recursing through expression arrays and stop objects. */
function recolor(value: unknown, target: string, scheme: 'light' | 'dark'): unknown {
  if (typeof value === 'string') {
    // Only rewrite things that actually parse as a colour — an expression's
    // operator strings ("interpolate", "linear", "zoom") must pass through.
    return parseColor(value) ? target : value;
  }
  if (Array.isArray(value)) return value.map((v) => recolor(v, target, scheme));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, recolor(v, target, scheme)]),
    );
  }
  return value;
}

/**
 * Re-tone a basemap style to the warm palette for `scheme`.
 *
 * Pure: the input spec is never mutated (the vendored JSON imports are shared
 * module singletons — mutating one would poison the Standard family too).
 */
export function warmBasemap(style: StyleSpecification, scheme: 'light' | 'dark'): StyleSpecification {
  const palette = scheme === 'dark' ? WARM_DARK : WARM_LIGHT;
  const layers = style.layers.map((layer) => {
    const paint = (layer as { paint?: Record<string, unknown> }).paint;
    if (!paint) return layer;
    const next: Record<string, unknown> = { ...paint };
    for (const [property, value] of Object.entries(paint)) {
      if (!property.endsWith('color')) continue;
      const role = roleFor(layer.id, property);
      next[property] = role
        ? recolor(value, palette[role], scheme)
        : recolorUnknown(value, scheme);
    }
    return { ...layer, paint: next };
  });
  return { ...style, layers } as StyleSpecification;
}

function recolorUnknown(value: unknown, scheme: 'light' | 'dark'): unknown {
  if (typeof value === 'string') return warmShift(value, scheme);
  if (Array.isArray(value)) return value.map((v) => recolorUnknown(v, scheme));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, recolorUnknown(v, scheme)]));
  }
  return value;
}
