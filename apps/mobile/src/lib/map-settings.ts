import { useSyncExternalStore } from 'react';

import { loadJSON, saveJSON, StorageKeys } from './storage';

/**
 * Which basemap the map screen draws.
 *
 * A family, not a single style — each resolves to a light/dark pair so the
 * appearance preference still picks the variant (see components/map-style.ts):
 *   - `standard` — the vendored positron / brightened dark-matter pair.
 *   - `warm`     — those same two re-toned to Dageraad & Gloed.
 *   - `liberty`  — OpenFreeMap Liberty, the detailed style the huismus website's
 *                  landing map uses. Light in both themes; it has no dark twin.
 */
export type BasemapFamily = 'standard' | 'warm' | 'liberty';

export const BASEMAP_FAMILIES: BasemapFamily[] = ['standard', 'warm', 'liberty'];

export interface MapSettings {
  /** Extrude the basemap's building footprints to their real-world height. */
  buildings3D: boolean;
  /** Which basemap family to draw. */
  basemap: BasemapFamily;
}

const DEFAULTS: MapSettings = { buildings3D: false, basemap: 'standard' };

/**
 * The map display preferences (currently just 3D buildings), persisted to
 * AsyncStorage. Same in-memory `useSyncExternalStore` shape as
 * {@link useAppearance} — an eagerly-readable store with async hydration on
 * boot, so a saved preference is applied before the map first renders.
 */
let current: MapSettings = DEFAULTS;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setBuildings3D(buildings3D: boolean) {
  if (buildings3D === current.buildings3D) return;
  current = { ...current, buildings3D };
  void saveJSON(StorageKeys.mapSettings, current);
  emit();
}

export function setBasemap(basemap: BasemapFamily) {
  if (basemap === current.basemap) return;
  current = { ...current, basemap };
  void saveJSON(StorageKeys.mapSettings, current);
  emit();
}

let hydrated = false;

/** Load the saved map settings. Safe to call repeatedly; runs once. */
export async function hydrateMapSettings() {
  if (hydrated) return;
  hydrated = true;
  const stored = await loadJSON<MapSettings>(StorageKeys.mapSettings);
  if (stored) current = { ...DEFAULTS, ...stored };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return current;
}

export function useMapSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...settings, setBuildings3D, setBasemap };
}

// Load any saved preference as early as the module is first imported (mirrors
// lib/appearance.ts), so the map's first render already reflects it.
void hydrateMapSettings();
