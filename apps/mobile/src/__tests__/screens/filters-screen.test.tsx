/* eslint-disable @typescript-eslint/no-require-imports */
import { DataProvider, queryClient } from '@huismus/data';
import { initI18n } from '@huismus/i18n';
import { act, fireEvent, render } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import type { ReactTestInstance } from 'react-test-renderer';

import FiltersScreen from '@/app/settings/filters';
import { resetFilters } from '@/lib/filters';

const { setOptions } = require('expo-router').useNavigation() as { setOptions: jest.Mock };

afterEach(() => {
  queryClient.clear();
  resetFilters();
  setOptions.mockClear();
});

// See range-slider.test.tsx — PanResponder needs a full single-touch bank.
function responderEvent() {
  return {
    nativeEvent: { touches: [{ pageX: 0, pageY: 0 }], changedTouches: [], pageX: 0, pageY: 0 },
    touchHistory: {
      touchBank: [
        {
          touchActive: true,
          startPageX: 0,
          startPageY: 0,
          startTimeStamp: 0,
          currentPageX: 0,
          currentPageY: 0,
          currentTimeStamp: 1,
          previousPageX: 0,
          previousPageY: 0,
          previousTimeStamp: 0,
        },
      ],
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: 1,
    },
  };
}

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

/**
 * Measures the first slider's track so its thumbs mount (layout events never fire
 * under Jest) and returns the price slider's low thumb.
 */
async function grabFirstThumb(view: Awaited<ReturnType<typeof renderScreen>>) {
  await act(async () => {
    fireEvent(view.getAllByTestId('range-slider-track')[0], 'layout', {
      nativeEvent: { layout: { width: 240, height: 24 } },
    });
  });
  return view.getAllByRole('adjustable')[0] as ReactTestInstance;
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
