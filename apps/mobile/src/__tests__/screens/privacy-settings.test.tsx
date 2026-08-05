import { initI18n, type SupportedLanguage } from '@huismus/i18n';
import { act, fireEvent, render } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';

import type { ReactTestInstance } from 'react-test-renderer';

import PrivacySettingsScreen from '@/app/settings/privacy';
import { isOptedOut, setOptedOut } from '@/lib/analytics';

import { mockOpenBrowserAsync } from '../../../test-setup';

async function renderScreen(language: SupportedLanguage = 'en') {
  const i18n = initI18n(language);
  await i18n.changeLanguage(language);
  return render(
    <I18nextProvider i18n={i18n}>
      <PrivacySettingsScreen />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  // Reset the module-level opt-out store so test order doesn't matter.
  setOptedOut(false);
  mockOpenBrowserAsync.mockClear();
});

/**
 * One act() scope per interaction. Firing events bare leaks the resulting state
 * updates out of React's act scope, which leaves every later render in the file
 * empty — so every press and toggle below goes through act.
 */
async function tap(element: ReactTestInstance) {
  await act(async () => {
    fireEvent.press(element);
  });
}

describe('PrivacySettingsScreen', () => {
  it('renders the usage-measurement opt-out control', async () => {
    const { getByText, getByRole } = await renderScreen();
    expect(getByText('Measure my in-app usage')).toBeTruthy();
    // On by default (not opted out).
    expect(getByRole('switch').props.value).toBe(true);
  });

  it('opts out when the switch is turned off, and back in when on', async () => {
    const { getByRole } = await renderScreen();
    const toggle = getByRole('switch');

    await act(async () => fireEvent(toggle, 'valueChange', false));
    expect(isOptedOut()).toBe(true);

    await act(async () => fireEvent(toggle, 'valueChange', true));
    expect(isOptedOut()).toBe(false);
  });

  it('opens the hosted legal documents instead of an in-app page', async () => {
    const { getByText } = await renderScreen();

    await tap(getByText('Privacy Policy'));
    expect(mockOpenBrowserAsync).toHaveBeenLastCalledWith(
      'https://huismusapp.com/en/privacy-policy/',
    );

    await tap(getByText('Terms of Use'));
    expect(mockOpenBrowserAsync).toHaveBeenLastCalledWith(
      'https://huismusapp.com/en/terms-of-use/',
    );
  });

  it('opens the Dutch documents when the app is in Dutch', async () => {
    const { getByText } = await renderScreen('nl');

    await tap(getByText('Privacyverklaring'));
    expect(mockOpenBrowserAsync).toHaveBeenLastCalledWith(
      'https://huismusapp.com/nl/privacy-policy/',
    );

    await tap(getByText('Gebruiksvoorwaarden'));
    expect(mockOpenBrowserAsync).toHaveBeenLastCalledWith(
      'https://huismusapp.com/nl/terms-of-use/',
    );
  });
});
