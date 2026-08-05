import { act, fireEvent } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

/**
 * Shared scaffolding for driving a `RangeSlider` under Jest. Three suites need
 * it (the component's own tests plus the Filters and onboarding screens), so it
 * lives here rather than being re-typed — and re-diverged — in each.
 */

/**
 * PanResponder derives its gestureState from the centroid of `touchHistory`, so a
 * hand-rolled responder event has to carry a full single-touch bank. Timestamps
 * must increase across moves, or PanResponder discards the later one as a
 * duplicate dispatch.
 *
 * `dx` accumulates from each record's previous → current position, so a move has
 * to state where the finger was as well as where it now is. The defaults describe
 * a stationary touch at the origin — enough for grant/release/terminate, which is
 * all the screen-level tests need.
 */
export function responderEvent({
  x = 0,
  y = 0,
  prevX = x,
  prevY = y,
  timestamp = 1,
}: { x?: number; y?: number; prevX?: number; prevY?: number; timestamp?: number } = {}) {
  return {
    nativeEvent: { touches: [{ pageX: x, pageY: y }], changedTouches: [], pageX: x, pageY: y },
    touchHistory: {
      touchBank: [
        {
          touchActive: true,
          startPageX: prevX,
          startPageY: prevY,
          startTimeStamp: 0,
          currentPageX: x,
          currentPageY: y,
          currentTimeStamp: timestamp,
          previousPageX: prevX,
          previousPageY: prevY,
          previousTimeStamp: timestamp - 1,
        },
      ],
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: timestamp,
    },
  };
}

interface Measurable {
  getAllByTestId: (id: string) => ReactTestInstance[];
  getAllByRole: (role: string) => ReactTestInstance[];
}

/**
 * Measures a slider's track so its thumbs mount — they render only once the
 * track has a width, and layout events never fire under Jest. Returns every
 * thumb that is now mounted, in render order (low thumb first).
 *
 * `trackIndex` picks the track on screens holding several sliders.
 */
export async function measureTrack(
  view: Measurable,
  { width = 240, trackIndex = 0 }: { width?: number; trackIndex?: number } = {},
): Promise<ReactTestInstance[]> {
  await act(async () => {
    fireEvent(view.getAllByTestId('range-slider-track')[trackIndex], 'layout', {
      nativeEvent: { layout: { width, height: 24 } },
    });
  });
  return view.getAllByRole('adjustable');
}
