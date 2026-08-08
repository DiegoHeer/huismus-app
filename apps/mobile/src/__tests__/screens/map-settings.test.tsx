import { initI18n } from '@huismus/i18n';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';

import MapSettingsScreen from '@/app/settings/map';
import { BASEMAP_FAMILIES, setBasemap } from '@/lib/map-settings';

async function renderScreen(language: 'en' | 'nl' = 'en') {
  const i18n = initI18n(language);
  return render(
    <I18nextProvider i18n={i18n}>
      <MapSettingsScreen />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  // The store is module-level, so reset it to keep test order irrelevant.
  setBasemap('standard');
});

describe('MapSettingsScreen basemap picker', () => {
  it('offers every family, with its hint', async () => {
    const { getByText } = await renderScreen();
    expect(getByText('Standard')).toBeTruthy();
    expect(getByText('Warm')).toBeTruthy();
    expect(getByText('Detailed')).toBeTruthy();
    expect(getByText(/Always light/)).toBeTruthy();
  });

  it('renders one row per family in BASEMAP_FAMILIES', async () => {
    const { getByTestId } = await renderScreen();
    for (const family of BASEMAP_FAMILIES) {
      expect(getByTestId(`basemap-option-${family}`)).toBeTruthy();
    }
  });

  it('ticks the active family and moves the tick when another is picked', async () => {
    const { getByTestId } = await renderScreen();
    // The check mark is an svg (per the test mock) inside the selected row.
    expect(within(getByTestId('basemap-option-standard')).queryByTestId('svg')).toBeTruthy();
    expect(within(getByTestId('basemap-option-warm')).queryByTestId('svg')).toBeNull();

    fireEvent.press(getByTestId('basemap-option-warm'));

    // The store is a useSyncExternalStore emit, so the re-render lands a tick later.
    await waitFor(() => {
      expect(within(getByTestId('basemap-option-warm')).queryByTestId('svg')).toBeTruthy();
    });
    expect(within(getByTestId('basemap-option-standard')).queryByTestId('svg')).toBeNull();
  });

  it('announces the selection as a radio group, checked rather than selected', async () => {
    const { getByTestId } = await renderScreen();
    // A lone role="radio" outside a group is an invalid ARIA structure, and the
    // group is what gives each row its "2 of 3" position.
    expect(getByTestId('basemap-picker').props.accessibilityRole).toBe('radiogroup');

    // role="radio" takes aria-checked; aria-selected is not one of its
    // supported states, so `{ selected }` would leave the state unannounced.
    expect(getByTestId('basemap-option-standard').props.accessibilityRole).toBe('radio');
    expect(getByTestId('basemap-option-standard').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(getByTestId('basemap-option-warm').props.accessibilityState).toMatchObject({
      checked: false,
    });

    fireEvent.press(getByTestId('basemap-option-liberty'));
    await waitFor(() => {
      expect(getByTestId('basemap-option-liberty').props.accessibilityState).toMatchObject({
        checked: true,
      });
    });
  });

  it('translates the picker', async () => {
    const { getByText } = await renderScreen('nl');
    expect(getByText('Kaartstijl')).toBeTruthy();
    expect(getByText('Gedetailleerd')).toBeTruthy();
  });
});
