import { useTranslation } from '@huismus/i18n';
import { useNavigation } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, type TextInputProps, View } from 'react-native';
import { DisplayText, Text, TextInput } from '@huismus/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { type AuthErrorCode } from '@/hooks/use-auth';
import { useBrand, useTheme } from '@/hooks/use-theme';

/**
 * i18n key for an auth failure code. The screens render `t(authErrorKey(code))`
 * so NL/PT users get localized copy; unmapped/`generic` codes fall back to the
 * generic message.
 */
export function authErrorKey(code: AuthErrorCode): string {
  switch (code) {
    case 'invalid_credentials':
      return 'auth.errorInvalidCredentials';
    case 'invalid_code':
      return 'auth.errorCodeInvalid';
    case 'email_taken':
      return 'auth.errorEmailTaken';
    case 'oauth_cancelled':
      return 'auth.errorOauthCancelled';
    case 'oauth_failed':
      return 'auth.errorOauthFailed';
    default:
      return 'auth.errorGeneric';
  }
}

/** Minimum password length enforced by the register form. */
export const MIN_PASSWORD_LENGTH = 8;

/** Pragmatic email check: a single `@` with non-empty, dot-bearing domain. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Normalize a typed/pasted code into the shape allauth emails: uppercase,
 * alphanumerics only, capped at 8 chars, grouped as `XXXX-XXXX`. (Mirrors
 * allauth's `generate_user_code` default — 8 chars, `dashed=True`, which stores
 * and emails the dashed string.) Submitting the dashed form matches the stored
 * code verbatim regardless of server-side normalization, so it's the robust
 * thing to send; input stays lenient (lowercase, spaces, a missing/extra dash
 * all collapse to the same canonical code). Shared by the email-verify and
 * password-reset screens, which both take this code.
 */
export function formatVerificationCode(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  return cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned;
}

/**
 * Screen scaffold shared by the login and register screens: a keyboard-aware,
 * scrollable column with a heading, an optional subtitle, and the form content.
 * Background and insets match the other pushed screens (settings).
 */
export function AuthScaffold({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-bg">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View className="gap-1.5">
            <DisplayText className="text-2xl font-bold text-ink">{title}</DisplayText>
            {subtitle ? <Text className="text-base text-ink-2">{subtitle}</Text> : null}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Labeled text input with an optional inline error message. Forwards all the
 * usual `TextInput` props (keyboardType, autoComplete, secureTextEntry, …); the
 * border turns red while an error is present.
 */
export function AuthField({
  label,
  error,
  ...inputProps
}: { label: string; error?: string } & TextInputProps) {
  const theme = useTheme();
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-ink-2">{label}</Text>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={label}
        className={`rounded-xl border bg-card px-4 py-3 text-base text-ink ${
          error ? 'border-accent' : 'border-border'
        }`}
        {...inputProps}
      />
      {error ? (
        <Text className="text-sm text-accent-text">{error}</Text>
      ) : null}
    </View>
  );
}

/** The screen's primary call-to-action (filled blue), matching the guest card. */
export function PrimaryButton({
  label,
  onPress,
  testID = 'auth-submit',
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      className="items-center rounded-xl bg-accent py-3.5 active:opacity-80">
      <Text className="text-base font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

/**
 * Decorative green check on a tinted circle, shown on the success views (email
 * verified, password reset). Hidden from the accessibility tree — the heading
 * carries the meaning.
 */
export function SuccessBadge() {
  const brand = useBrand();
  return (
    <View accessible={false} className="items-center py-2">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-success/15">
        <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
          <Path
            d="M20 6 9 17l-5-5"
            stroke={brand.success}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </View>
  );
}

/** "──── or ────" separator between the email form and the social buttons. */
export function OrDivider() {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-px flex-1 bg-border" />
      <Text className="text-sm uppercase text-ink-2">{t('auth.orDivider')}</Text>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}

/** Google's four-color "G" mark. */
function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <Path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </Svg>
  );
}

/**
 * "Continue with Google" sign-in button — the only social provider the backend
 * supports. Neutral surface with the multicolor Google mark; exposes
 * `testID="oauth-button"` for tests.
 */
export function OAuthButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  /** Ignore presses (and dim) while a sign-in is already in flight. */
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const dimmed = disabled ? 'opacity-60' : '';

  return (
    <Pressable
      testID="oauth-button"
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={t('auth.continueWithGoogle')}
      className={`flex-row items-center justify-center gap-2.5 rounded-xl border border-border bg-card py-3.5 active:opacity-70 ${dimmed}`}>
      <GoogleMark />
      <Text className="text-base font-semibold text-ink">
        {t('auth.continueWithGoogle')}
      </Text>
    </Pressable>
  );
}

/**
 * In-place "you're logged in" landing view, shown by the login and register
 * screens after a successful social sign-in — the OAuth counterpart of the
 * verify/reset success views (green check + a Continue button; navigation
 * happens on the button's own gesture, a frame later, per the recycled-bitmap
 * workaround). Retitles the header and drops the back affordance so the
 * consumed form can't be swiped back into.
 */
export function LoginSuccessView({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      title: t('auth.loggedInTitle'),
      headerBackVisible: false,
      gestureEnabled: false,
    });
  }, [navigation, t]);

  return (
    <AuthScaffold title={t('auth.loggedInTitle')} subtitle={t('auth.loggedInSubtitle')}>
      <View className="gap-6">
        <SuccessBadge />
        <PrimaryButton testID="auth-continue" label={t('auth.loggedInCta')} onPress={onContinue} />
      </View>
    </AuthScaffold>
  );
}

/**
 * Footer row that cross-links the login and register screens, e.g.
 * "Don't have an account? Sign up".
 */
export function AuthSwitchLink({
  prompt,
  actionLabel,
  onPress,
}: {
  prompt: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <View className="flex-row items-center justify-center gap-1.5 pt-1">
      <Text className="text-sm text-ink-2">{prompt}</Text>
      <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8} className="active:opacity-60">
        <Text className="text-sm font-semibold text-accent-text">
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}
