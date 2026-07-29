/**
 * Drag thresholds and outcome rules for the map preview card's swipe gestures:
 * pull the card down to dismiss it, push it up to open the full listing.
 *
 * Plain functions carrying the `'worklet'` directive, so the same rules run on
 * the UI thread inside the pan handler (where they must be synchronous) and can
 * still be called — and unit-tested — from the JS thread.
 */

/** Downward travel (px) over which the card fades 1 → 0 as it's dragged away. */
export const FADE_TRAVEL = 200;

/**
 * Where the card animates to once a dismissal is committed. Past FADE_TRAVEL so
 * it is fully transparent by the time it arrives.
 */
export const DISMISS_EXIT_Y = FADE_TRAVEL + 80;

/** Length of the commit-to-dismissal animation (ms). */
export const DISMISS_DURATION = 200;

/** Past this much downward travel, releasing dismisses instead of springing back. */
const DISMISS_DISTANCE = 90;
/** A downward flick at least this fast (px/s) dismisses regardless of distance. */
const DISMISS_VELOCITY = 800;

/** Past this much upward travel, releasing opens the listing. */
const OPEN_DISTANCE = 56;
/** An upward flick at least this fast (px/s) opens regardless of distance. */
const OPEN_VELOCITY = 700;

/**
 * Upward drags rubber-band — the card follows the finger at this rate only, and
 * never past OPEN_MAX. Downward drags track the finger 1:1 instead: that
 * direction ends in dismissal, so the card should feel like it's being thrown
 * away rather than tugged against a stop.
 */
const OPEN_RESISTANCE = 0.5;
const OPEN_MAX = 80;

export type SwipeOutcome = 'dismiss' | 'open' | 'cancel';

/**
 * Where the card sits for a given amount of finger travel. Down tracks 1:1; up
 * is resisted and capped so the card can't be dragged off the top edge.
 */
export function cardDragOffset(translationY: number): number {
  'worklet';
  if (translationY >= 0) return translationY;
  return Math.max(translationY * OPEN_RESISTANCE, -OPEN_MAX);
}

/**
 * What releasing the card should do. Distance and velocity each suffice on
 * their own, so a short flick counts — but both must agree on the direction,
 * which is what keeps a fast downward release after dragging the card *up* from
 * dismissing it.
 */
export function resolveCardSwipe(translationY: number, velocityY: number): SwipeOutcome {
  'worklet';
  if (translationY > 0 && (translationY > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY)) {
    return 'dismiss';
  }
  if (translationY < 0 && (translationY < -OPEN_DISTANCE || velocityY < -OPEN_VELOCITY)) {
    return 'open';
  }
  return 'cancel';
}
