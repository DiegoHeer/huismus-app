import { initI18n } from '@huismus/i18n';
import type { Listing } from '@huismus/types';
import { act, fireEvent, render } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';

import { ListingCard } from '@/components/listing-card';
import { clearLikes } from '@/lib/likes';
import { mockGestures } from '../../../test-setup';

// Accessibility labels of the heart toggle (from packages/i18n en.json).
const LIKE = 'Save to favorites';
const UNLIKE = 'Remove from favorites';

function makeListing(id: string, title: string): Listing {
  return {
    id,
    title,
    price: 500000,
    currency: 'EUR',
    status: 'for_sale',
    bedrooms: 2,
    bathrooms: 1,
    areaSqm: 84,
    address: { line1: 'Teststraat 1', city: 'Amsterdam', postalCode: '1011 AB', country: 'NL' },
    location: { latitude: 52.37, longitude: 4.89 },
    images: [{ id: `${id}_img`, url: 'https://example.test/cover.jpg' }],
    createdAt: '2024-01-01T00:00:00.000Z',
  };
}

const i18n = initI18n('en');

async function renderCard(listing: Listing) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ListingCard listing={listing} />
    </I18nextProvider>,
  );
}

// React 19 + RNTL flush an interaction's re-render only when it has its own
// settled act() scope; without it the next query reads pre-update state. So
// wrap the press here (mirrors the `tap` helper in screens/login.test.tsx).
async function tap(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element);
  });
}

// The likes store is a module singleton; reset it so each test starts clean.
// Gestures are recorded per render, so drop earlier ones too (see test-setup).
beforeEach(() => {
  clearLikes();
  mockGestures.length = 0;
});

describe('ListingCard like button', () => {
  it('starts unliked and toggles when pressed', async () => {
    const { getByLabelText } = await renderCard(makeListing('lst_a', 'Apartment A'));

    expect(getByLabelText(LIKE)).toBeTruthy();
    await tap(getByLabelText(LIKE));
    expect(getByLabelText(UNLIKE)).toBeTruthy();
  });

  // The card stays mounted while the user browses markers — only the `listing`
  // prop changes. The heart must track the listing under it, not carry over.
  it('reflects each listing as the user browses between them', async () => {
    const a = makeListing('lst_a', 'Apartment A');
    const b = makeListing('lst_b', 'House B');

    const { getByLabelText, rerender } = await renderCard(a);

    // Like A.
    await tap(getByLabelText(LIKE));
    expect(getByLabelText(UNLIKE)).toBeTruthy();

    // Browse to B — it was never liked, so the heart resets to empty.
    await rerender(
      <I18nextProvider i18n={i18n}>
        <ListingCard listing={b} />
      </I18nextProvider>,
    );
    expect(getByLabelText(LIKE)).toBeTruthy();

    // Browse back to A — still liked (the store remembers it).
    await rerender(
      <I18nextProvider i18n={i18n}>
        <ListingCard listing={a} />
      </I18nextProvider>,
    );
    expect(getByLabelText(UNLIKE)).toBeTruthy();
  });
});

// Vertical drag: down to dismiss, up to open. The thresholds themselves are
// covered in card-swipe.test.ts; these tests pin the wiring — that each outcome
// reaches the right callback, exactly once, and that dragging never doubles as a
// tap. The pan gesture is driven through the recorded handlers (see test-setup),
// since the mocked GestureDetector has no touch pipeline of its own.
describe('ListingCard swipe gestures', () => {
  // `render` must be awaited (RNTL v14 returns a promise, as `renderCard` above
  // relies on too) — the component body, and so the gesture it builds, hasn't
  // run yet when the call returns.
  async function renderSwipeable() {
    const onPress = jest.fn();
    const onClose = jest.fn();
    const view = await render(
      <I18nextProvider i18n={i18n}>
        <ListingCard listing={makeListing('lst_a', 'Apartment A')} onPress={onPress} onClose={onClose} />
      </I18nextProvider>,
    );
    // The card builds exactly one gesture, so the newest recorded one is it.
    const pan = mockGestures.at(-1)!.handlers;
    return { ...view, pan, onPress, onClose };
  }

  /** A full touch: press down, cross the activation offset, drag, release. */
  async function swipe(
    pan: Record<string, (...args: any[]) => unknown>,
    translationY: number,
    velocityY = 0,
  ) {
    await act(async () => {
      pan.onBegin?.({});
      pan.onStart?.({});
      pan.onUpdate?.({ translationY });
      pan.onEnd?.({ translationY, velocityY });
    });
  }

  it('dismisses on a downward swipe', async () => {
    const { pan, onPress, onClose } = await renderSwipeable();

    await swipe(pan, 130);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('opens the listing on an upward swipe', async () => {
    const { pan, onPress, onClose } = await renderSwipeable();

    await swipe(pan, -80);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does neither when the drag is released short of the threshold', async () => {
    const { pan, onPress, onClose } = await renderSwipeable();

    await swipe(pan, 40);

    expect(onPress).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  // On web a pan doesn't cancel the Pressable under it: the browser still fires
  // a click on release. Without the latch, every drag would also open the
  // listing — and an upward swipe would navigate twice.
  it('swallows the press that a drag leaves behind', async () => {
    const { pan, getByText, onPress } = await renderSwipeable();

    await swipe(pan, 40);
    await act(async () => {
      fireEvent.press(getByText('Apartment A'));
    });

    expect(onPress).not.toHaveBeenCalled();
  });

  it('still opens on a plain tap, and on the tap after a drag', async () => {
    const { pan, getByText, onPress } = await renderSwipeable();

    // A tap on its own — nothing latched, so it opens.
    await act(async () => {
      fireEvent.press(getByText('Apartment A'));
    });
    expect(onPress).toHaveBeenCalledTimes(1);

    // A drag swallows its trailing press, but must not eat the *next* real tap.
    await swipe(pan, 40);
    await act(async () => {
      fireEvent.press(getByText('Apartment A'));
    });
    expect(onPress).toHaveBeenCalledTimes(1);

    await act(async () => {
      pan.onBegin?.({});
      fireEvent.press(getByText('Apartment A'));
    });
    expect(onPress).toHaveBeenCalledTimes(2);
  });
});
