import { initI18n } from '@huismus/i18n';
import { act, fireEvent, render } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';

import { ModePills, PriceRangeField, type PriceRange } from '@/components/filter-controls';
import { priceSteps, type ListingMode } from '@/lib/filters';

import { measureTrack, responderEvent } from '../support/slider-gestures';

const TRACK_WIDTH = 200;
const BUY_STEPS = priceSteps('buy');
const TOP_INDEX = BUY_STEPS.length - 1;

// `render` resolves asynchronously here, and its queries are not own-enumerable,
// so the result is awaited and then passed through whole rather than spread.
async function renderField(value: PriceRange, mode: ListingMode = 'buy') {
  const onChange = jest.fn();
  const i18n = initI18n('en');
  const view = await render(
    <I18nextProvider i18n={i18n}>
      <PriceRangeField mode={mode} value={value} onChange={onChange} />
    </I18nextProvider>,
  );
  const thumbs = await measureTrack(view, { width: TRACK_WIDTH });
  return { view, onChange, thumbs };
}

/** The index each thumb reports through its accessibility value. */
function thumbIndices(thumbs: Awaited<ReturnType<typeof renderField>>['thumbs']) {
  return thumbs.map((t) => t.props.accessibilityValue.now);
}

describe('PriceRangeField', () => {
  it('parks both thumbs on the end stops when neither bound is set', async () => {
    const { thumbs, view } = await renderField([null, null]);
    expect(thumbIndices(thumbs)).toEqual([0, TOP_INDEX]);
    expect(view.getByText('Any')).toBeTruthy();
  });

  it('summarises an open low end without inventing a €0 floor', async () => {
    const { view } = await renderField([null, 450_000]);
    expect(view.getByText('≤ €450k')).toBeTruthy();
  });

  it('summarises an open high end without the top stop', async () => {
    const { view } = await renderField([300_000, null]);
    expect(view.getByText('≥ €300k')).toBeTruthy();
  });

  it('snaps a persisted off-ladder price onto the nearest stop', async () => {
    // 310k is not a stop; the ladder steps 25k through this band, so it reads
    // back as 300k — and the summary has to agree with where the thumb sits.
    const { view, thumbs } = await renderField([310_000, 450_000]);
    expect(view.getByText('€300k – €450k')).toBeTruthy();
    expect(BUY_STEPS[thumbIndices(thumbs)[0]]).toBe(300_000);
  });

  // The screens store `null` for "no constraint", so a thumb dragged onto an end
  // stop must report null rather than the stop's euro value — otherwise parking
  // it there would silently apply a €0 (or €5M) bound to the query.
  it('reports an end stop as null so an open end never becomes a filter', async () => {
    const { thumbs, onChange } = await renderField([200_000, 450_000]);

    // Drag the high thumb a full track width right: past the top, so it clamps.
    thumbs[1].props.onResponderGrant(responderEvent());
    thumbs[1].props.onResponderMove(responderEvent({ x: TRACK_WIDTH, prevX: 0, timestamp: 2 }));

    expect(onChange).toHaveBeenLastCalledWith([200_000, null]);
  });

  it('reports the low end stop as null too', async () => {
    const { thumbs, onChange } = await renderField([200_000, 450_000]);

    thumbs[0].props.onResponderGrant(responderEvent());
    thumbs[0].props.onResponderMove(responderEvent({ x: -TRACK_WIDTH, prevX: 0, timestamp: 2 }));

    expect(onChange).toHaveBeenLastCalledWith([null, 450_000]);
  });

  // A bound that snaps onto an end stop is unconstrained as far as `onChange` is
  // concerned, so the summary has to read it that way too — otherwise a stored
  // value below the first stop prints the "€0" floor this label set out to kill.
  it('reads a bound that snaps onto an end stop as open, not as a €0 floor', async () => {
    const { view } = await renderField([5_000, 450_000]);
    expect(BUY_STEPS[0]).toBe(0); // the stop 5k snaps to
    expect(view.getByText('≤ €450k')).toBeTruthy();
  });

  it('reads a bound that snaps onto the top stop as open', async () => {
    const { view } = await renderField([300_000, 5_000_000]);
    expect(view.getByText('≥ €300k')).toBeTruthy();
  });

  it('switches the ladder with the mode', async () => {
    // Rent tops out three orders of magnitude lower and has its own number of
    // stops, so both the summary and the slider's index domain change with it.
    const { view, thumbs } = await renderField([1450, null], 'rent');
    expect(view.getByText('≥ €1450')).toBeTruthy();
    expect(thumbs[0].props.accessibilityValue.max).toBe(priceSteps('rent').length - 1);
    expect(priceSteps('rent').length).not.toBe(BUY_STEPS.length);
  });
});

describe('ModePills', () => {
  async function renderPills(mode: ListingMode = 'buy') {
    const onChange = jest.fn();
    const i18n = initI18n('en');
    const view = await render(
      <I18nextProvider i18n={i18n}>
        <ModePills mode={mode} onChange={onChange} />
      </I18nextProvider>,
    );
    return { view, onChange };
  }

  it('marks the active mode and keeps Rent visible but unselectable', async () => {
    const { view, onChange } = await renderPills('buy');

    expect(view.getByText('Rent coming soon')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Buy' }).props.accessibilityState).toMatchObject({
      selected: true,
      disabled: false,
    });

    // A press on the dimmed Rent pill is swallowed, not forwarded.
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Rent' })));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports the picked mode', async () => {
    const { view, onChange } = await renderPills('rent');
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Buy' })));
    expect(onChange).toHaveBeenCalledWith('buy');
  });

  // Callers clear the staged price range in `onChange`, so a press that doesn't
  // actually change the mode must not reach them — it would reset a range the
  // user had set.
  it('swallows a press on the mode that is already active', async () => {
    const { view, onChange } = await renderPills('buy');
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Buy' })));
    expect(onChange).not.toHaveBeenCalled();
  });
});
