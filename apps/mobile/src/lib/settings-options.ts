import { supportedLanguages, type SupportedLanguage } from '@huismus/i18n';

import { MonitorIcon, MoonIcon, SunIcon, type Icon } from '@/components/icons';

import type { Appearance } from './appearance';

/**
 * Endonyms (each language named in itself) with a flag emoji. Not translated —
 * a language switcher always shows every option in its own language. The
 * `Record` forces a label whenever a new language is added to `supportedLanguages`.
 */
export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: '🇬🇧 English',
  nl: '🇳🇱 Nederlands',
  pt: '🇵🇹 Português',
};

/** Appearance options for the selector. `labelKey` is translated; `icon` is decoration. */
export const APPEARANCE_OPTIONS: { value: Appearance; icon: Icon; labelKey: string }[] = [
  { value: 'system', icon: MonitorIcon, labelKey: 'profile.appearance_system' },
  { value: 'light', icon: SunIcon, labelKey: 'profile.appearance_light' },
  { value: 'dark', icon: MoonIcon, labelKey: 'profile.appearance_dark' },
];

/**
 * The active UI language as one of {@link supportedLanguages}. Falls back to the
 * resolved language when `i18n.language` is a regional variant (e.g. `en-US`)
 * that isn't itself in the supported list.
 */
export function activeLanguage(i18n: {
  language: string;
  resolvedLanguage?: string;
}): SupportedLanguage {
  return (
    supportedLanguages.includes(i18n.language as SupportedLanguage)
      ? i18n.language
      : i18n.resolvedLanguage
  ) as SupportedLanguage;
}
