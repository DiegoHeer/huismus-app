import { initI18n } from '@huismus/i18n';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import type { ReactTestInstance } from 'react-test-renderer';

import FeedbackScreen from '@/app/settings/feedback';

// The screen posts through @huismus/data's submitFeedback. Replace the module
// with a plain spread of the real one so the export is a writable jest.fn (the
// real barrel re-exports are non-configurable getters), then script its outcome
// per test — no real network request fires. (Same approach as login.test.tsx.)
jest.mock('@huismus/data', () => ({
  ...jest.requireActual('@huismus/data'),
  submitFeedback: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { submitFeedback } = require('@huismus/data') as { submitFeedback: jest.Mock };

async function renderScreen(language: 'en' | 'nl' = 'en') {
  const i18n = initI18n(language);
  // changeLanguage is async; apply before asserting on localized copy.
  await i18n.changeLanguage(language);
  return render(
    <I18nextProvider i18n={i18n}>
      <FeedbackScreen />
    </I18nextProvider>,
  );
}

// One interaction per act() so each re-render settles before the next read
// (see the note in login.test.tsx).
async function typeInto(input: ReactTestInstance, text: string) {
  await act(async () => {
    fireEvent.changeText(input, text);
  });
}

async function tap(element: ReactTestInstance) {
  await act(async () => {
    fireEvent.press(element);
  });
}

beforeEach(() => {
  submitFeedback.mockReset();
});

describe('FeedbackScreen', () => {
  it('does not submit until there is non-whitespace text', async () => {
    const { getByTestId, getByPlaceholderText } = await renderScreen('en');

    await tap(getByTestId('feedback-submit'));
    expect(submitFeedback).not.toHaveBeenCalled();

    await typeInto(getByPlaceholderText('Share your thoughts…'), '   ');
    await tap(getByTestId('feedback-submit'));
    expect(submitFeedback).not.toHaveBeenCalled();
  });

  it('submits the trimmed message with device/app context and confirms sent', async () => {
    submitFeedback.mockResolvedValue({ id: 1, created_at: '2026-07-11T00:00:00Z' });
    const { getByTestId, getByPlaceholderText, findByText } = await renderScreen('en');

    await typeInto(getByPlaceholderText('Share your thoughts…'), '  Love the app  ');
    await tap(getByTestId('feedback-submit'));

    expect(await findByText('Feedback sent')).toBeOnTheScreen();
    // jest-expo runs as iOS; expo-constants is mocked to version 1.0.0.
    expect(submitFeedback).toHaveBeenCalledWith({
      message: 'Love the app',
      app_version: '1.0.0',
      platform: 'ios',
      locale: 'en',
    });
    // The field clears so more can be sent.
    expect(getByPlaceholderText('Share your thoughts…').props.value).toBe('');
  });

  it('shows an inline error and keeps the text for a retry when the send fails', async () => {
    submitFeedback
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ id: 2, created_at: '2026-07-11T00:00:00Z' });
    const { getByTestId, getByPlaceholderText, findByText } = await renderScreen('en');

    await typeInto(getByPlaceholderText('Share your thoughts…'), 'Something broke');
    await tap(getByTestId('feedback-submit'));

    expect(await findByText("Couldn't send your feedback. Please try again.")).toBeOnTheScreen();
    // Text is preserved so the same message can be retried.
    expect(getByPlaceholderText('Share your thoughts…').props.value).toBe('Something broke');

    await tap(getByTestId('feedback-submit'));
    expect(await findByText('Feedback sent')).toBeOnTheScreen();
    await waitFor(() => expect(submitFeedback).toHaveBeenCalledTimes(2));
  });

  it('sends the active locale (Dutch) as context', async () => {
    submitFeedback.mockResolvedValue({ id: 3, created_at: '2026-07-11T00:00:00Z' });
    const { getByTestId, getByPlaceholderText, findByText } = await renderScreen('nl');

    await typeInto(getByPlaceholderText('Deel je gedachten…'), 'Mooie app');
    await tap(getByTestId('feedback-submit'));

    expect(await findByText('Feedback verzonden')).toBeOnTheScreen();
    expect(submitFeedback).toHaveBeenCalledWith(expect.objectContaining({ locale: 'nl' }));
  });

  describe('character limit', () => {
    it('caps the field at 512 characters', async () => {
      const { getByPlaceholderText } = await renderScreen('en');

      expect(getByPlaceholderText('Share your thoughts…').props.maxLength).toBe(512);
    });

    it('stays silent about the limit until it is reached', async () => {
      const { getByPlaceholderText, queryByText } = await renderScreen('en');
      const input = getByPlaceholderText('Share your thoughts…');

      await typeInto(input, 'a'.repeat(511));
      expect(queryByText("You've reached the 512-character limit.")).toBeNull();

      await typeInto(input, 'a'.repeat(512));
      expect(queryByText("You've reached the 512-character limit.")).toBeOnTheScreen();

      // Deleting back under the cap hides it again.
      await typeInto(input, 'a'.repeat(400));
      expect(queryByText("You've reached the 512-character limit.")).toBeNull();
    });
  });

  describe('sentiment', () => {
    it('submits without a marker when no sentiment is picked', async () => {
      submitFeedback.mockResolvedValue({ id: 4, created_at: '2026-07-11T00:00:00Z' });
      const { getByTestId, getByPlaceholderText, findByText } = await renderScreen('en');

      await typeInto(getByPlaceholderText('Share your thoughts…'), 'No opinion either way');
      await tap(getByTestId('feedback-submit'));

      expect(await findByText('Feedback sent')).toBeOnTheScreen();
      expect(submitFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'No opinion either way' }),
      );
    });

    it.each([
      ['positive', ':thumbsup:'],
      ['neutral', ':neutral_face:'],
      ['negative', ':thumbsdown:'],
    ])('prefixes the message with the %s marker', async (option, marker) => {
      submitFeedback.mockResolvedValue({ id: 5, created_at: '2026-07-11T00:00:00Z' });
      const { getByTestId, getByPlaceholderText, findByText } = await renderScreen('en');

      await typeInto(getByPlaceholderText('Share your thoughts…'), '  Worth saying  ');
      await tap(getByTestId(`feedback-sentiment-${option}`));
      await tap(getByTestId('feedback-submit'));

      expect(await findByText('Feedback sent')).toBeOnTheScreen();
      expect(submitFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ message: `${marker}\n\nWorth saying` }),
      );
    });

    it('keeps exactly one pill checked, like a radio group', async () => {
      const { getByTestId } = await renderScreen('en');
      const positive = getByTestId('feedback-sentiment-positive');
      const negative = getByTestId('feedback-sentiment-negative');

      expect(positive.props.accessibilityState.checked).toBe(false);
      expect(negative.props.accessibilityState.checked).toBe(false);

      await tap(positive);
      expect(positive.props.accessibilityState.checked).toBe(true);

      await tap(negative);
      expect(positive.props.accessibilityState.checked).toBe(false);
      expect(negative.props.accessibilityState.checked).toBe(true);

      // Re-tapping the checked pill keeps it checked — radios don't clear.
      await tap(negative);
      expect(negative.props.accessibilityState.checked).toBe(true);
    });

    it('clears the pick along with the text after a successful send', async () => {
      submitFeedback.mockResolvedValue({ id: 6, created_at: '2026-07-11T00:00:00Z' });
      const { getByTestId, getByPlaceholderText, findByText } = await renderScreen('en');

      await typeInto(getByPlaceholderText('Share your thoughts…'), 'Great');
      await tap(getByTestId('feedback-sentiment-positive'));
      await tap(getByTestId('feedback-submit'));

      expect(await findByText('Feedback sent')).toBeOnTheScreen();
      expect(getByTestId('feedback-sentiment-positive').props.accessibilityState.checked).toBe(
        false,
      );
    });

    it('keeps the pick for a retry when the send fails', async () => {
      submitFeedback
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce({ id: 7, created_at: '2026-07-11T00:00:00Z' });
      const { getByTestId, getByPlaceholderText, findByText } = await renderScreen('en');

      await typeInto(getByPlaceholderText('Share your thoughts…'), 'Broken');
      await tap(getByTestId('feedback-sentiment-negative'));
      await tap(getByTestId('feedback-submit'));

      expect(await findByText("Couldn't send your feedback. Please try again.")).toBeOnTheScreen();
      expect(getByTestId('feedback-sentiment-negative').props.accessibilityState.checked).toBe(true);

      await tap(getByTestId('feedback-submit'));
      await waitFor(() => expect(submitFeedback).toHaveBeenCalledTimes(2));
      expect(submitFeedback).toHaveBeenLastCalledWith(
        expect.objectContaining({ message: ':thumbsdown:\n\nBroken' }),
      );
    });
  });
});
