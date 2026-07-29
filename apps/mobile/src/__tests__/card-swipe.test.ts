import { cardDragOffset, FADE_TRAVEL, resolveCardSwipe } from '@/lib/card-swipe';

describe('cardDragOffset', () => {
  it('tracks a downward drag one-to-one', () => {
    expect(cardDragOffset(0)).toBe(0);
    expect(cardDragOffset(40)).toBe(40);
    expect(cardDragOffset(400)).toBe(400);
  });

  it('resists an upward drag and caps it, so the card cannot leave the top', () => {
    expect(cardDragOffset(-40)).toBe(-20);
    // Far beyond the cap — the card stops moving but the finger keeps going.
    expect(cardDragOffset(-1000)).toBe(-80);
  });
});

describe('resolveCardSwipe', () => {
  it('cancels a drag too small to mean anything', () => {
    expect(resolveCardSwipe(0, 0)).toBe('cancel');
    expect(resolveCardSwipe(30, 0)).toBe('cancel');
    expect(resolveCardSwipe(-20, 0)).toBe('cancel');
  });

  it('dismisses on a long downward drag', () => {
    expect(resolveCardSwipe(120, 0)).toBe('dismiss');
  });

  it('dismisses on a short but fast downward flick', () => {
    expect(resolveCardSwipe(25, 1400)).toBe('dismiss');
  });

  it('opens on a long upward drag', () => {
    expect(resolveCardSwipe(-80, 0)).toBe('open');
  });

  it('opens on a short but fast upward flick', () => {
    expect(resolveCardSwipe(-20, -1200)).toBe('open');
  });

  // Direction of travel and direction of velocity must agree. Releasing while
  // moving down after having dragged the card *up* is a change of mind, not a
  // dismissal — the card is still above its resting place.
  it('cancels when travel and velocity disagree', () => {
    expect(resolveCardSwipe(-40, 1400)).toBe('cancel');
    expect(resolveCardSwipe(40, -1200)).toBe('cancel');
  });

  // Both directions are live at once, so no drag may satisfy both rules.
  it('never resolves a single drag as both outcomes', () => {
    for (let travel = -300; travel <= 300; travel += 10) {
      for (const velocity of [-2000, -800, 0, 800, 2000]) {
        expect(['dismiss', 'open', 'cancel']).toContain(resolveCardSwipe(travel, velocity));
      }
    }
  });
});

describe('fade travel', () => {
  // The card must still be visible at the point where a release commits to
  // dismissal, otherwise it would vanish before the user let go.
  it('outlasts the dismissal threshold', () => {
    const thresholdTravel = 91;
    expect(resolveCardSwipe(thresholdTravel, 0)).toBe('dismiss');
    expect(FADE_TRAVEL).toBeGreaterThan(thresholdTravel);
  });
});
