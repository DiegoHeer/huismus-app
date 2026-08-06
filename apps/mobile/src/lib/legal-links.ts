import { openBrowserAsync } from 'expo-web-browser';

import { WEB_BASE_URL } from '@/constants/app';

/**
 * The Privacy Policy and Terms of Use live on the marketing site, not in the
 * app, so there's a single authoritative copy to keep up to date. Tapping a
 * legal link opens that page in an in-app browser (a new tab on web).
 */
export type LegalDocument = 'privacy-policy' | 'terms-of-use';

/**
 * Only English and Dutch versions of the documents are published, so Dutch app
 * language gets `/nl/` and every other language falls back to `/en/`.
 */
export function legalUrl(document: LegalDocument, language: string | undefined): string {
  const locale = language?.toLowerCase().startsWith('nl') ? 'nl' : 'en';
  return `${WEB_BASE_URL}/${locale}/${document}/`;
}

/**
 * Fire-and-forget open of a legal document, in the language the app is showing.
 * Rejections are swallowed: iOS throws when a browser is already presented (a
 * fast double-tap on the row), and there's nothing useful to tell the user.
 */
export function openLegalDocument(document: LegalDocument, language: string | undefined) {
  void openBrowserAsync(legalUrl(document, language)).catch(() => {});
}
