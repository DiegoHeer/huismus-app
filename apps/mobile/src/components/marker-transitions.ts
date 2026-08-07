import type { Listing } from '@huismus/types';
import { useEffect, useState } from 'react';

/**
 * A new viewport's homes replace the old ones wholesale, which without help
 * reads as the whole marker layer blinking. These helpers diff the two sets by
 * id so each pin can be told whether it is arriving, leaving, or was there all
 * along — and, crucially, keep a departing pin mounted long enough to fade out.
 * React would otherwise unmount it the frame its listing disappears, leaving
 * nothing to animate.
 */

/**
 * How long an arriving marker's fade — and the jump that goes with it — runs,
 * in ms. Longer than the exit on purpose: a pin appearing is worth watching,
 * and the jump needs room to read as an arc rather than a twitch.
 */
export const MARKER_ENTER_MS = 150;

/** How long a departing marker's fade runs, in ms. Quick — it is just cleanup. */
export const MARKER_EXIT_MS = 50;

/**
 * Upper bound on the random stagger before a marker starts animating. A single
 * pin's animation is brief either way; the scatter is what turns a swap into a
 * ripple across the map rather than one hard cut.
 */
export const MARKER_STAGGER_MS = 100;

/** Peak height of the entrance jump, in px above the marker's resting anchor. */
export const MARKER_JUMP_PX = 14;

/** Longest a leaving marker can still need: its own stagger plus the fade. */
const LEAVE_LIFETIME_MS = MARKER_STAGGER_MS + MARKER_EXIT_MS;

export type MarkerPhase = 'steady' | 'entering' | 'leaving';

export interface MarkerTransition {
  listing: Listing;
  phase: MarkerPhase;
  /** Stagger before this marker animates, in ms. Always 0 when `steady`. */
  delay: number;
}

export interface MarkerTransitionState {
  /** The array this state was reconciled against, for change detection. */
  source: Listing[];
  rendered: MarkerTransition[];
  /**
   * Whether a set of markers has been on the map yet. The first one appears
   * rather than arrives: on a cold open every pin is "new", and animating all
   * of them is a cascade over the busiest moment of startup for no gain.
   */
  seeded: boolean;
}

function stagger(): number {
  return Math.random() * MARKER_STAGGER_MS;
}

function steady(listing: Listing): MarkerTransition {
  return { listing, phase: 'steady', delay: 0 };
}

/** The state a fresh `useMarkerTransitions` starts from. */
export function initialMarkerState(listings: Listing[]): MarkerTransitionState {
  return { source: listings, rendered: listings.map(steady), seeded: listings.length > 0 };
}

/**
 * Diff `listings` against what is on the map and assign each pin its phase.
 * Pure, so the caller can run it during render — see {@link useMarkerTransitions}.
 */
export function reconcileMarkers(
  state: MarkerTransitionState,
  listings: Listing[],
): MarkerTransitionState {
  const { seeded } = state;
  // Pins currently on the map under their own steam. Ones already fading are
  // excluded: a listing that comes back should re-enter, not resume dying.
  const present = new Map<string, MarkerTransition>();
  for (const entry of state.rendered) {
    if (entry.phase !== 'leaving') present.set(entry.listing.id, entry);
  }
  const nextIds = new Set(listings.map((listing) => listing.id));

  const rendered: MarkerTransition[] = listings.map((listing) => {
    const existing = present.get(listing.id);
    // Already there: keep the phase so an entrance in flight isn't restarted,
    // but take the newer listing — price and viewed state can have changed.
    if (existing) return existing.listing === listing ? existing : { ...existing, listing };
    return seeded ? { listing, phase: 'entering', delay: stagger() } : steady(listing);
  });

  // Missing from the new answer: hold it on the map long enough to fade out.
  for (const entry of present.values()) {
    if (!nextIds.has(entry.listing.id)) {
      rendered.push({ listing: entry.listing, phase: 'leaving', delay: stagger() });
    }
  }
  // Pins already fading keep their place until the sweep below drops them.
  for (const entry of state.rendered) {
    if (entry.phase === 'leaving' && !nextIds.has(entry.listing.id)) rendered.push(entry);
  }

  return { source: listings, rendered, seeded: seeded || listings.length > 0 };
}

/**
 * The markers to draw for `listings`, each tagged with how it should animate.
 * Includes pins that have left the data but are still fading out.
 */
export function useMarkerTransitions(listings: Listing[]): MarkerTransition[] {
  const [state, setState] = useState(() => initialMarkerState(listings));

  // Reconciled during render, not in an effect. An effect would paint the new
  // pins once at full opacity before flipping them to their entrance frame, and
  // that frame is a visible flash. Setting state during render instead makes
  // React re-run this component before committing, so nothing reaches the
  // screen un-animated.
  if (state.source !== listings) setState(reconcileMarkers(state, listings));

  useEffect(() => {
    if (!state.rendered.some((entry) => entry.phase === 'leaving')) return;
    // Re-armed on every reconcile, so a batch that starts fading while an older
    // one is mid-flight still gets its full window — the older pins linger a
    // little, but they are already at zero opacity, so nothing shows for it.
    const timer = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        rendered: prev.rendered.filter((entry) => entry.phase !== 'leaving'),
      }));
    }, LEAVE_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [state.rendered]);

  return state.rendered;
}
