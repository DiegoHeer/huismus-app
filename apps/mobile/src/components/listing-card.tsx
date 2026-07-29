import { formatPrice } from '@huismus/data';
import { useTranslation } from '@huismus/i18n';
import type { Listing } from '@huismus/types';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  cardDragOffset,
  DISMISS_DURATION,
  DISMISS_EXIT_Y,
  FADE_TRAVEL,
  resolveCardSwipe,
} from '@/lib/card-swipe';
import { LikeButton } from './like-button';

// Matches the area sheet's snap-back feel (see area-sheet.tsx).
const SPRING = { damping: 24, stiffness: 220, mass: 0.7 } as const;

export interface ListingCardProps {
  listing: Listing;
  /** Tapping the card body, or swiping it up (open the full listing). */
  onPress?: () => void;
  /** Dismiss the card — the × button, or a downward swipe. */
  onClose?: () => void;
}

/**
 * Compact preview of a listing — a condensed version of the detail screen,
 * shown above the tab bar when a map marker is selected. Layout mirrors the
 * Airbnb map preview: full-width cover image with an overlaid close button,
 * then the listing details stacked beneath.
 *
 * The card is also draggable on the vertical axis: pulling it down moves it with
 * the finger while fading it out, and releasing past the threshold throws it off
 * screen and dismisses it (`onClose`). Pushing it up rubber-bands against a stop
 * — a hint that there's more behind it — and releasing opens the full listing
 * (`onPress`). See lib/card-swipe.ts for the thresholds.
 *
 * Requires a `GestureHandlerRootView` ancestor (provided at the app root).
 */
export function ListingCard({ listing, onPress, onClose }: ListingCardProps) {
  const { t, i18n } = useTranslation();
  const cover = listing.images[0];

  /** Card's vertical offset from its resting place; also drives its opacity. */
  const translateY = useSharedValue(0);

  // Did this touch turn into a real drag? On web a pan doesn't cancel the
  // Pressable underneath it the way it does on native — the browser still fires
  // a click on release, which would open the listing on every single drag. So
  // latch when the pan wins the touch and swallow the press that follows it.
  // A shared value rather than a ref: the pan's worklets can then set it
  // directly, and on web (the only platform where the stray click happens)
  // there's a single thread, so the latch is always up by the time it's read.
  const panned = useSharedValue(false);

  // Opening the listing, unless this "press" is really the tail of a drag. The
  // latch is armed in onStart (which runs only once the pan has won) and cleared
  // on the next touch down, so a genuine tap is never swallowed — and an
  // upward swipe, which navigates from onEnd, can't navigate twice.
  const handlePress = () => {
    if (panned.value) {
      panned.value = false;
      return;
    }
    onPress?.();
  };

  const pan = Gesture.Pan()
    // Claim the gesture only once the finger has clearly moved on the vertical
    // axis, so plain taps still reach the card body and the buttons overlaid on
    // it, and a horizontal drag never nudges the card.
    .activeOffsetY([-12, 12])
    .failOffsetX([-24, 24])
    .onBegin(() => {
      panned.value = false;
    })
    .onStart(() => {
      panned.value = true;
    })
    .onUpdate((e) => {
      translateY.value = cardDragOffset(e.translationY);
    })
    .onEnd((e) => {
      const outcome = resolveCardSwipe(e.translationY, e.velocityY);
      if (outcome === 'dismiss') {
        // Keep travelling down (and so fading) past the point of no return, then
        // hand off to the parent, which unmounts the card. Bailing out when the
        // animation didn't finish keeps an interrupted exit from deselecting.
        translateY.value = withTiming(DISMISS_EXIT_Y, { duration: DISMISS_DURATION }, (done) => {
          if (done && onClose) runOnJS(onClose)();
        });
        return;
      }
      translateY.value = withSpring(0, SPRING);
      if (outcome === 'open' && onPress) runOnJS(onPress)();
    });

  // One driver for both properties: the further down the card is dragged, the
  // more transparent it gets. Clamped, so the resisted upward drag stays opaque.
  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(translateY.value, [0, FADE_TRAVEL], [1, 0], Extrapolation.CLAMP),
  }));

  const facts = [
    listing.bedrooms ? t('listing.beds', { count: listing.bedrooms }) : null,
    listing.bathrooms ? t('listing.baths', { count: listing.bathrooms }) : null,
    listing.areaSqm ? t('listing.area', { value: listing.areaSqm }) : null,
  ].filter((f): f is string => f != null);

  return (
    // The Animated.View carries only the drag transform/opacity; the card's own
    // styling stays on the plain View inside it, same split as the area sheet.
    <GestureDetector gesture={pan}>
      <Animated.View style={dragStyle}>
        <View className="overflow-hidden rounded-2xl bg-white shadow-lg dark:bg-neutral-900">
          {/* Card body: tapping anywhere here opens the full listing. The action
              buttons below are rendered as siblings (overlaid) rather than nested
              inside this Pressable — on web a Pressable becomes a <button>, and a
              <button> cannot legally contain another <button>. */}
          <Pressable
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityHint={t('listing.swipeHint')}
            className="active:opacity-95">
            <View>
              {cover ? (
                // draggable={false} is web-only: without it the browser starts a
                // native image drag as soon as the finger moves, which steals the
                // pointer and kills the swipe whenever it begins on the cover.
                <Image
                  source={{ uri: cover.url }}
                  style={{ width: '100%', height: 180 }}
                  contentFit="cover"
                  draggable={false}
                />
              ) : (
                <View className="h-[180px] w-full bg-neutral-200 dark:bg-neutral-800" />
              )}
            </View>

            <View className="gap-0.5 p-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-base font-semibold text-neutral-900 dark:text-white" numberOfLines={1}>
                  {listing.title}
                </Text>
                <Text className="text-xs font-medium uppercase text-blue-600 dark:text-blue-400">
                  {t(`listing.status.${listing.status}`)}
                </Text>
              </View>

              <Text className="text-sm text-neutral-500" numberOfLines={1}>
                {listing.address.line1}, {listing.address.postalCode} {listing.address.city}
              </Text>

              {facts.length ? (
                <Text className="text-sm text-neutral-500">{facts.join('  ·  ')}</Text>
              ) : null}

              <Text className="mt-0.5 text-base font-bold text-neutral-900 dark:text-white">
                {formatPrice(listing.price, listing.currency, i18n.language)}
              </Text>
            </View>
          </Pressable>

          <View
            className="absolute inset-x-0 top-0 flex-row justify-end gap-3 p-5"
            pointerEvents="box-none">
            <LikeButton listing={listing} />
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('listing.close')}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center rounded-full bg-white shadow active:opacity-70">
              <Text className="text-2xl leading-none text-neutral-700">×</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
