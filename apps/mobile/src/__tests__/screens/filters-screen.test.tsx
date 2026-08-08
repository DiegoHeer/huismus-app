/* eslint-disable @typescript-eslint/no-require-imports */
import { DataProvider, queryClient } from '@huismus/data';
import { initI18n } from '@huismus/i18n';
import { act, render } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import type { ReactTestInstance } from 'react-test-renderer';

import FiltersScreen from '@/app/settings/filters';
import { resetFilters } from '@/lib/filters';

import { measureTrack, responderEvent } from '../support/slider-gestures';

const { setOptions } = require('expo-router').useNavigation() as { setOptions: jest.Mock };

afterEach(() => {
  queryClient.clear();
  resetFilters();
  setOptions.mockClear();
});

async function renderScreen() {
  const i18n = initI18n('en');
  const view = render(
    <I18nextProvider i18n={i18n}>
      <DataProvider>
        <FiltersScreen />
      </DataProvider>
    </I18nextProvider>,
  );
  return view;
}

/** The price slider's low thumb, its track measured so the thumbs mount. */
async function grabFirstThumb(view: Awaited<ReturnType<typeof renderScreen>>) {
  return (await measureTrack(view))[0] as ReactTestInstance;
}

describe('FiltersScreen slider drags', () => {
  it('renders a slider per numeric filter', async () => {
    const view = await renderScreen();
    // Price, bedrooms, bathrooms, size, build year.
    expect(view.getAllByTestId('range-slider-track')).toHaveLength(5);
  });

  it('freezes the scroll view while a thumb is being dragged', async () => {
    const view = await renderScreen();
    const thumb = await grabFirstThumb(view);

    expect(view.getByTestId('filters-scroll').props.scrollEnabled).toBe(true);

    await act(async () => thumb.props.onResponderGrant(responderEvent()));
    expect(view.getByTestId('filters-scroll').props.scrollEnabled).toBe(false);

    await act(async () => thumb.props.onResponderRelease(responderEvent()));
    expect(view.getByTestId('filters-scroll').props.scrollEnabled).toBe(true);
  });

  it('suspends the swipe-back gesture while a thumb is being dragged', async () => {
    const view = await renderScreen();
    const thumb = await grabFirstThumb(view);

    await act(async () => thumb.props.onResponderGrant(responderEvent()));
    expect(setOptions).toHaveBeenCalledWith({ gestureEnabled: false });

    setOptions.mockClear();
    await act(async () => thumb.props.onResponderRelease(responderEvent()));
    expect(setOptions).toHaveBeenCalledWith({ gestureEnabled: true });
  });

  it('restores both gestures when a drag is cancelled mid-flight', async () => {
    const view = await renderScreen();
    const thumb = await grabFirstThumb(view);

    await act(async () => thumb.props.onResponderGrant(responderEvent()));
    await act(async () => thumb.props.onResponderTerminate(responderEvent()));

    expect(view.getByTestId('filters-scroll').props.scrollEnabled).toBe(true);
    expect(setOptions).toHaveBeenCalledWith({ gestureEnabled: true });
  });
});
