import type { MapBounds } from '@huismus/types';

/**
 * Where the map was when the user last left it.
 *
 * Switching tabs unmounts the map screen, so without this it comes back framed
 * on the national default. That is not just a lost position: a different framing
 * is a different quantized viewport, which is a different residence query key —
 * so the homes the user was already looking at get fetched again and animate in
 * again, for a round trip that should have changed nothing.
 *
 * Read once when the screen mounts, which is what makes the restore invisible:
 * with the viewport already known on the first render, React Query answers from
 * cache synchronously, so the pins are part of the initial state rather than an
 * arrival, and nothing animates.
 *
 * Deliberately in memory rather than AsyncStorage. This is "carry on where you
 * were", not a saved preference — a cold start should still open on the default
 * framing, or on the preferred city queued at boot (see lib/map-focus.ts).
 */
export interface MapCameraState {
  longitude: number;
  latitude: number;
  zoom: number;
  /** The quantized rectangle the residence query was scoped to, if any. */
  viewport: MapBounds | null;
}

let remembered: MapCameraState | null = null;

/** Record the framing, on every camera settle. */
export function rememberMapCamera(state: MapCameraState): void {
  remembered = state;
}

/** The framing to restore, or null when the map has not been opened yet. */
export function rememberedMapCamera(): MapCameraState | null {
  return remembered;
}

/**
 * Forget the framing. Nothing in the app calls this — the store is meant to
 * outlive any one screen — but tests need each case to start from a cold map.
 */
export function clearMapCamera(): void {
  remembered = null;
}
