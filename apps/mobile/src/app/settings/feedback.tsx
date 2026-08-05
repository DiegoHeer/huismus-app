import { submitFeedback, type FeedbackIn, type FeedbackPlatform } from '@huismus/data';
import { isSupportedLanguage, useTranslation } from '@huismus/i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { NeutralFaceIcon, ThumbsDownIcon, ThumbsUpIcon } from '@/components/icons';
import { APP_VERSION } from '@/constants/app';

/** Placeholder grey that reads on both light and dark inputs (neutral-400). */
const PLACEHOLDER_COLOR = '#9ca3af';

/**
 * Hard cap on the message. Purely a client-side courtesy — `POST /v1/feedback`
 * imposes no length of its own — so it's enforced on what the user types and the
 * sentiment marker below is added on top of it.
 */
const MAX_MESSAGE_LENGTH = 512;

type Status = 'idle' | 'sending' | 'sent' | 'error';

type Sentiment = 'positive' | 'neutral' | 'negative';

/**
 * The backend has no sentiment field yet, so the pick rides along as an emoji
 * shortcode on the first line of the message — readable as-is and rendered by
 * the Slack/GitHub-style shortcode set wherever feedback is triaged. Swap these
 * for a real request field once the API grows one.
 */
const SENTIMENT_MARKER: Record<Sentiment, string> = {
  positive: ':thumbsup:',
  neutral: ':neutral_face:',
  negative: ':thumbsdown:',
};

/** Left-to-right order of the pills. `as const` keeps the `t()` keys literal. */
const SENTIMENT_OPTIONS = [
  { value: 'positive', icon: ThumbsUpIcon, labelKey: 'feedback.sentimentPositive' },
  { value: 'neutral', icon: NeutralFaceIcon, labelKey: 'feedback.sentimentNeutral' },
  { value: 'negative', icon: ThumbsDownIcon, labelKey: 'feedback.sentimentNegative' },
] as const;

/** Prefix the message with the sentiment marker, when one was picked. */
function composeMessage(text: string, sentiment: Sentiment | null): string {
  const message = text.trim();
  return sentiment ? `${SENTIMENT_MARKER[sentiment]}\n\n${message}` : message;
}

/**
 * Optional device/app context sent alongside the message for triage. `Platform.OS`
 * is narrowed to the values the backend accepts, the UI language is sent only when
 * it's one we ship, and the version is clamped to the backend's 20-char limit.
 */
function feedbackContext(language: string): Omit<FeedbackIn, 'message'> {
  const os = Platform.OS;
  const platform: FeedbackPlatform | undefined =
    os === 'ios' || os === 'android' || os === 'web' ? os : undefined;
  return {
    app_version: APP_VERSION.slice(0, 20),
    platform,
    locale: isSupportedLanguage(language) ? language : undefined,
  };
}

/** Feather-style check mark shown on the button once feedback is "sent". */
function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Feedback screen (pushed from the profile Support section). A multiline field
 * capped at {@link MAX_MESSAGE_LENGTH}, an optional sentiment picker, and a
 * submit button that POSTs to `/v1/feedback` (see `submitFeedback`). The
 * button moves idle → sending → sent in place and we stay on the screen (the
 * field clears) so more can be sent; a failed send surfaces an inline error and
 * keeps the text so it can be retried. Mirrors the keyboard-aware layout of the
 * auth screens (see `components/auth-ui.tsx`).
 */
export default function FeedbackScreen() {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState('');
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  // Guards the post-await state updates from landing after the screen unmounts
  // mid-send.
  const mounted = useRef(true);
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  // Retryable from the initial idle state and after a failed send.
  const canSubmit = (status === 'idle' || status === 'error') && text.trim().length > 0;
  const atLimit = text.length >= MAX_MESSAGE_LENGTH;

  /**
   * Editing after a terminal state returns the button to idle, clearing a shown
   * "sent" confirmation or error message.
   */
  function clearTerminalStatus() {
    if (status === 'sent' || status === 'error') setStatus('idle');
  }

  async function submit() {
    if (!canSubmit) return;
    setStatus('sending');
    try {
      await submitFeedback({
        message: composeMessage(text, sentiment),
        ...feedbackContext(i18n.language),
      });
      if (!mounted.current) return;
      // Leave the button on its "sent" confirmation; typing again resets it.
      setStatus('sent');
      setText('');
      setSentiment(null);
    } catch {
      if (mounted.current) setStatus('error');
    }
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-neutral-100 dark:bg-black">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text className="text-base text-neutral-500">{t('feedback.subtitle')}</Text>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t('feedback.label')}
            </Text>
            <TextInput
              value={text}
              onChangeText={(next) => {
                setText(next);
                clearTerminalStatus();
              }}
              multiline
              autoFocus
              editable={status !== 'sending'}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={t('feedback.placeholder')}
              placeholderTextColor={PLACEHOLDER_COLOR}
              accessibilityLabel={t('feedback.label')}
              style={{ minHeight: 160, textAlignVertical: 'top' }}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            />
            {/* No running counter — the cap only becomes visible once it bites. */}
            {atLimit ? (
              <Text
                accessibilityLiveRegion="polite"
                className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('feedback.limitReached', { max: MAX_MESSAGE_LENGTH })}
              </Text>
            ) : null}
          </View>

          <SentimentPicker
            value={sentiment}
            disabled={status === 'sending'}
            onChange={(next) => {
              setSentiment(next);
              clearTerminalStatus();
            }}
          />

          <SubmitButton status={status} disabled={!canSubmit} onPress={submit} />

          {status === 'error' ? (
            <Text
              accessibilityRole="alert"
              className="text-center text-sm text-red-600 dark:text-red-400">
              {t('feedback.error')}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Three pills under the message field, side by side, behaving as a radio group:
 * exactly one can be active and — like a radio — re-tapping the active one keeps
 * it. Nothing is picked by default and a sentiment is never required to send, so
 * a marker only ever reaches the message when the user deliberately chose one.
 */
function SentimentPicker({
  value,
  disabled,
  onChange,
}: {
  value: Sentiment | null;
  disabled: boolean;
  onChange: (next: Sentiment) => void;
}) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const activeIcon = dark ? '#60a5fa' : '#2563eb';
  const idleIcon = dark ? '#a3a3a3' : '#737373';

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {t('feedback.sentimentLabel')}
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('feedback.sentimentLabel')}
        className="flex-row gap-2">
        {SENTIMENT_OPTIONS.map(({ value: option, icon: Icon, labelKey }) => {
          const selected = value === option;
          return (
            <Pressable
              key={option}
              testID={`feedback-sentiment-${option}`}
              onPress={() => onChange(option)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border py-3 ${
                selected
                  ? 'border-blue-600 bg-blue-50 dark:border-blue-400 dark:bg-blue-950'
                  : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900'
              } ${disabled ? 'opacity-50' : 'active:opacity-80'}`}>
              <Icon color={selected ? activeIcon : idleIcon} />
              <Text
                className={`text-sm font-medium ${
                  selected
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-neutral-700 dark:text-neutral-300'
                }`}>
                {t(labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Stateful primary button: blue "Send feedback" when idle or after an error
 * (ready to retry), a disabled spinner while sending, and a green confirmation
 * once sent. Styling tracks `PrimaryButton` in `components/auth-ui.tsx`.
 */
function SubmitButton({
  status,
  disabled,
  onPress,
}: {
  status: Status;
  disabled: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();

  if (status === 'sent') {
    return (
      <View
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        className="flex-row items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5">
        <CheckIcon color="#ffffff" />
        <Text className="text-base font-semibold text-white">{t('feedback.sent')}</Text>
      </View>
    );
  }

  const sending = status === 'sending';

  return (
    <Pressable
      testID="feedback-submit"
      onPress={onPress}
      disabled={disabled || sending}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || sending, busy: sending }}
      className={`flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 ${
        disabled && !sending ? 'opacity-50' : 'active:opacity-80'
      }`}>
      {sending ? <ActivityIndicator color="#ffffff" /> : null}
      <Text className="text-base font-semibold text-white">
        {sending ? t('feedback.submitting') : t('feedback.submit')}
      </Text>
    </Pressable>
  );
}
