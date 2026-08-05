import { openBrowserAsync } from 'expo-web-browser';

/**
 * The Privacy Policy and Terms of Use live on the marketing site, not in the
 * app, so there's a single authoritative copy to keep up to date. Tapping a
 * legal link opens that page in an in-app browser (a new tab on web).
 */
const BASE_URL = 'https://huismusapp.com';

export type LegalDocument = 'privacy-policy' | 'terms-of-use';

/**
 * Only English and Dutch versions of the documents are published, so Dutch app
 * language gets `/nl/` and every other language falls back to `/en/`.
 */
export function legalUrl(document: LegalDocument, language: string | undefined): string {
  const locale = language?.toLowerCase().startsWith('nl') ? 'nl' : 'en';
  return `${BASE_URL}/${locale}/${document}/`;
}

/** Fire-and-forget open of a legal document, in the language the app is showing. */
export function openLegalDocument(document: LegalDocument, language: string | undefined) {
  void openBrowserAsync(legalUrl(document, language));
}
