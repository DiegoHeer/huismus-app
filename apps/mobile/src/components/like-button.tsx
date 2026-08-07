import { useTranslation } from '@huismus/i18n';
import type { Listing } from '@huismus/types';
import { Pressable } from 'react-native';

import { Colors } from '../constants/theme';
import { HeartIcon } from './icons';
import { useBrand } from '@/hooks/use-theme';
import { toggleLike, useIsLiked } from '../lib/likes';

/**
 * Circular heart toggle for liking/favoriting a listing. Extracted from the map
 * preview card so the same affordance can be reused there and on the explore
 * feed cards (via the cross-package `@huismus/ui` ListingCard's `likeButton`
 * slot) — keeping that UI package decoupled from the app's likes storage. Being
 * a component (not inline JSX) also lets each card call the `useIsLiked` hook
 * per listing without breaking the rules of hooks.
 */
export function LikeButton({ listing }: { listing: Listing }) {
  const { t } = useTranslation();
  const brand = useBrand();
  const liked = useIsLiked(listing.id);
  return (
    <Pressable
      onPress={() => toggleLike(listing)}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={t(liked ? 'listing.unlike' : 'listing.like')}
      hitSlop={8}
      className="h-11 w-11 items-center justify-center rounded-full bg-white shadow active:opacity-70">
      <HeartIcon filled={liked} color={liked ? brand.accent : Colors.light.textSecondary} />
    </Pressable>
  );
}
