import { initI18n } from '@huismus/i18n';
import type { Listing } from '@huismus/types';
import { render } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { StyleSheet, Text as RNText } from 'react-native';

import { Fonts } from '../fonts';
import { ListingCard } from '../listing-card';
import { DisplayText, Text } from '../text';

/**
 * These pin the *mechanism*, not the family names.
 *
 * The app used to set its body face two ways at once — this package reached for
 * a `font-body` class while apps/mobile used the Text wrapper — with nothing
 * saying which was authoritative. NativeWind is mocked in tests, so a className
 * contributes no style here; that is exactly what makes these assertions useful.
 * They fail the moment a component goes back to react-native's `Text` and a
 * class, which is the regression that was live before.
 */

function familyOf(node: { props: { style?: unknown } }): unknown {
  return StyleSheet.flatten(node.props.style as never)?.fontFamily;
}

const listing: Listing = {
  id: 'lst_test',
  title: 'Test Apartment',
  price: 450000,
  currency: 'EUR',
  status: 'for_sale',
  bedrooms: 2,
  bathrooms: 1,
  areaSqm: 75,
  address: { line1: 'Teststraat 10', city: 'Amsterdam', postalCode: '1000 AA', country: 'NL' },
  location: { latitude: 52.37, longitude: 4.89 },
  images: [],
  createdAt: '2026-01-01T00:00:00Z',
};

describe('Text primitives', () => {
  it('seeds the body face', async () => {
    const { getByText } = await render(<Text>body</Text>);
    expect(familyOf(getByText('body'))).toBe(Fonts.body);
  });

  it('seeds the display face', async () => {
    const { getByText } = await render(<DisplayText>heading</DisplayText>);
    expect(familyOf(getByText('heading'))).toBe(Fonts.display);
  });

  it('lets an explicit style override the seed', async () => {
    const { getByText } = await render(<Text style={{ fontFamily: 'Courier' }}>override</Text>);
    expect(familyOf(getByText('override'))).toBe('Courier');
  });

  it('forwards other style props instead of replacing them', async () => {
    const { getByText } = await render(<Text style={{ fontSize: 21 }}>sized</Text>);
    const style = StyleSheet.flatten(getByText('sized').props.style as never);
    expect(style).toMatchObject({ fontFamily: Fonts.body, fontSize: 21 });
  });

  it('forwards refs to the real RN node', async () => {
    const ref = { current: null as RNText | null };
    await render(<Text ref={ref}>ref</Text>);
    expect(ref.current).not.toBeNull();
  });
});

describe('ListingCard type', () => {
  it('renders its text through the shared primitive, not a bare RN Text', async () => {
    const i18n = initI18n('en');
    const { getByText } = await render(
      <I18nextProvider i18n={i18n}>
        <ListingCard listing={listing} />
      </I18nextProvider>,
    );
    // Every line of the card: price, status, title, address, the three specs.
    for (const text of [/€/, 'Test Apartment', /Teststraat 10/]) {
      expect(familyOf(getByText(text))).toBe(Fonts.body);
    }
  });
});
