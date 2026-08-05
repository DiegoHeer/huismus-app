import { act, render, renderHook } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { RangeSlider } from '@/components/range-slider';
import { useSliderDragLock } from '@/hooks/use-slider-drag-lock';

import { measureTrack, responderEvent } from '../support/slider-gestures';

const TRACK_WIDTH = 200;

/** Renders a slider and returns its thumbs, track already measured. */
async function renderSlider(props: Partial<Parameters<typeof RangeSlider>[0]> = {}) {
  const onDragStart = jest.fn();
  const onDragEnd = jest.fn();
  const view = await render(
    <RangeSlider
      min={0}
      max={10}
      values={[3]}
      onChange={jest.fn()}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      {...props}
    />,
  );
  const thumbs = await measureTrack(view, { width: TRACK_WIDTH });
  return { ...view, onDragStart, onDragEnd, thumbs };
}

describe('RangeSlider gesture contract', () => {
  it('renders one thumb per value', async () => {
    expect((await renderSlider({ values: [2] })).thumbs).toHaveLength(1);
    expect((await renderSlider({ values: [2, 7] })).thumbs).toHaveLength(2);
  });

  it('claims the touch on press-down, before any movement', async () => {
    const { thumbs } = await renderSlider();
    expect(thumbs[0].props.onStartShouldSetResponder()).toBe(true);
  });

  it('blocks the native responder so Android ScrollViews stay out of the drag', async () => {
    const { thumbs } = await renderSlider();
    // PanResponder returns onShouldBlockNativeResponder's value from the grant.
    expect(thumbs[0].props.onResponderGrant(responderEvent())).toBe(true);
  });

  it('refuses to hand an in-flight drag to another responder', async () => {
    const { thumbs } = await renderSlider();
    thumbs[0].props.onResponderGrant(responderEvent());
    expect(thumbs[0].props.onResponderTerminationRequest(responderEvent())).toBe(false);
  });

  it('reports drag start and end so the host can lock its gestures', async () => {
    const { thumbs, onDragStart, onDragEnd } = await renderSlider();

    thumbs[0].props.onResponderGrant(responderEvent());
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDragEnd).not.toHaveBeenCalled();

    thumbs[0].props.onResponderRelease(responderEvent());
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });

  it('reports drag end when the gesture is cancelled, so the lock cannot stick', async () => {
    const { thumbs, onDragEnd } = await renderSlider();
    thumbs[0].props.onResponderGrant(responderEvent());
    thumbs[0].props.onResponderTerminate(responderEvent());
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });

  it('still moves the thumb across the track (drag maths intact)', async () => {
    const onChange = jest.fn();
    const { thumbs } = await renderSlider({ values: [3], onChange });

    thumbs[0].props.onResponderGrant(responderEvent());
    // Half the 200px track on a 0–10 domain = +5 steps, from 3 to 8.
    thumbs[0].props.onResponderMove(
      responderEvent({ x: TRACK_WIDTH / 2, prevX: 0, timestamp: 2 }),
    );

    expect(onChange).toHaveBeenCalledWith([8]);
  });
});

describe('useSliderDragLock', () => {
  it('tracks the drag and keeps the callbacks stable across renders', async () => {
    const { result, rerender } = await renderHook(() => useSliderDragLock());
    const first = result.current.sliderDrag;

    expect(result.current.dragging).toBe(false);

    await act(async () => result.current.sliderDrag.onDragStart());
    expect(result.current.dragging).toBe(true);

    await act(async () => result.current.sliderDrag.onDragEnd());
    expect(result.current.dragging).toBe(false);

    await act(async () => rerender({}));
    expect(result.current.sliderDrag).toBe(first);
  });
});

// A dragged thumb must not double as a scroll: fed a drag, the lock has to reach
// the host's scrollable. Proven per-screen in filters-screen/onboarding tests;
// here just that the wiring a host writes actually flips.
describe('drag lock wiring', () => {
  it('flips a scrollEnabled flag for the duration of a thumb drag', async () => {
    let thumbs: ReactTestInstance[] = [];
    const scrollEnabled: boolean[] = [];

    function Host() {
      const { dragging, sliderDrag } = useSliderDragLock();
      scrollEnabled.push(!dragging);
      return <RangeSlider min={0} max={10} values={[3]} onChange={jest.fn()} {...sliderDrag} />;
    }

    const view = await render(<Host />);
    thumbs = await measureTrack(view, { width: TRACK_WIDTH });

    await act(async () => thumbs[0].props.onResponderGrant(responderEvent()));
    expect(scrollEnabled.at(-1)).toBe(false);

    await act(async () => thumbs[0].props.onResponderRelease(responderEvent()));
    expect(scrollEnabled.at(-1)).toBe(true);
  });
});
