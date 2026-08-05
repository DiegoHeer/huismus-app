import { legalUrl, openLegalDocument } from '@/lib/legal-links';

import { mockOpenBrowserAsync } from '../../test-setup';

describe('legalUrl', () => {
  it('serves the Dutch documents when the app language is Dutch', () => {
    expect(legalUrl('privacy-policy', 'nl')).toBe('https://huismusapp.com/nl/privacy-policy/');
    expect(legalUrl('terms-of-use', 'nl')).toBe('https://huismusapp.com/nl/terms-of-use/');
  });

  it('serves the English documents for English', () => {
    expect(legalUrl('privacy-policy', 'en')).toBe('https://huismusapp.com/en/privacy-policy/');
    expect(legalUrl('terms-of-use', 'en')).toBe('https://huismusapp.com/en/terms-of-use/');
  });

  it('falls back to English for languages we do not publish', () => {
    // Only en/nl exist on the site, so Portuguese (and anything unknown) gets en.
    expect(legalUrl('privacy-policy', 'pt')).toBe('https://huismusapp.com/en/privacy-policy/');
    expect(legalUrl('terms-of-use', undefined)).toBe('https://huismusapp.com/en/terms-of-use/');
  });

  it('matches region-tagged and differently-cased Dutch tags', () => {
    expect(legalUrl('privacy-policy', 'nl-NL')).toBe('https://huismusapp.com/nl/privacy-policy/');
    expect(legalUrl('privacy-policy', 'NL')).toBe('https://huismusapp.com/nl/privacy-policy/');
  });
});

describe('openLegalDocument', () => {
  beforeEach(() => {
    mockOpenBrowserAsync.mockClear();
  });

  it('opens the document in the in-app browser', () => {
    openLegalDocument('terms-of-use', 'nl');
    expect(mockOpenBrowserAsync).toHaveBeenCalledWith('https://huismusapp.com/nl/terms-of-use/');
  });
});
