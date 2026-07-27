import { useMemo, useState } from 'react';

/**
 * Tracks whether a `RangeSlider` thumb is currently being dragged, so the screen
 * hosting it can stand down every gesture that would otherwise hijack the drag.
 *
 * Android needs no help: PanResponder's `onShouldBlockNativeResponder` defaults
 * to true, so the JS responder on the thumb blocks the enclosing native
 * ScrollView. iOS has no equivalent. RN's iOS scroll view only steps aside when a
 * JS responder sits on one of its *ancestors* (`_shouldDisableScrollInteraction`
 * walks superviews only), and a thumb is a descendant — so UIScrollView cancels
 * the content touch and scrolls, stealing the drag. Same story for a stack
 * screen's swipe-back, which most thumbs sit right next to at their minimum. The
 * only reliable fix is to disable those gestures ourselves while a drag is live.
 *
 * Spread `sliderDrag` onto every RangeSlider on the screen, then feed `dragging`
 * to everything that must yield: `scrollEnabled={!dragging}` on each scrollable
 * ancestor (vertical *and* horizontal — a pager counts), and
 * `gestureEnabled: !dragging` on a stack screen with a swipe-back. Release and
 * cancellation both end a drag, so the lock can't be left on.
 */
export function useSliderDragLock() {
  const [dragging, setDragging] = useState(false);
  // Stable identity: RangeSlider keeps these in a ref it refreshes each render,
  // and a fresh object every render would churn it for no reason.
  const sliderDrag = useMemo(
    () => ({
      onDragStart: () => setDragging(true),
      onDragEnd: () => setDragging(false),
    }),
    [],
  );
  return { dragging, sliderDrag };
}
