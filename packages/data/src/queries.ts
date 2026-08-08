import type { AreaPolygon, CityShape, ListingQuery, NeighborhoodStats } from '@huismus/types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  getAreas,
  getCities,
  getCityNames,
  getStats,
  getListing,
  getListingsCount,
  getListingsPage,
  type CityName,
} from './client';

/** Centralised query keys so caches invalidate consistently. */
export const listingKeys = {
  all: ['listings'] as const,
  list: (query: ListingQuery) => ['listings', 'list', query] as const,
  count: (query: ListingQuery) => ['listings', 'count', query] as const,
  detail: (id: string) => ['listings', 'detail', id] as const,
};

/** Options the map needs and the Listings feed deliberately does not. */
export interface UseListingsOptions {
  /**
   * Defer the first fetch. The map waits for the viewport it reports on load,
   * rather than fetching the country first and immediately discarding it.
   */
  enabled?: boolean;
  /**
   * Hold the previous result on screen while the next one loads, so the map
   * never flashes empty mid-gesture. Callers distinguish the two states via
   * `isLoading` (first load, nothing to show) vs `isFetching` (refreshing).
   *
   * Off by default: a list that changes filters *should* show its loading state.
   */
  keepPrevious?: boolean;
  /** How long a result stays fresh, in ms. Defaults to React Query's 0. */
  staleTime?: number;
  /**
   * Whether mounting refetches a result that is cached but has gone stale.
   *
   * The map turns this off. Its screen unmounts on a tab switch, and coming
   * back should put the user's viewport back exactly as they left it — a
   * refetch there would spend a request purely because time passed, which is
   * the opposite of what returning to a tab should cost. A genuine pan is
   * unaffected: that is a different key, and it fetches.
   */
  refetchOnMount?: boolean;
}

/**
 * Residences matching `query`, plus the server's total match count (see
 * {@link getListingsPage} — the map draws at most a few pages, so the two differ
 * wherever homes are dense). The map passes the visible `bbox`, so every pan or
 * zoom is a new query key.
 *
 * The `signal` is threaded into the fetch on purpose: React Query only aborts a
 * superseded query if its query function consumed the signal, and a fast pan
 * otherwise leaves every abandoned viewport's requests running to completion.
 */
export function useListings(query: ListingQuery = {}, options: UseListingsOptions = {}) {
  return useQuery({
    queryKey: listingKeys.list(query),
    queryFn: ({ signal }) => getListingsPage(query, signal),
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
    enabled: options.enabled ?? true,
    staleTime: options.staleTime,
    refetchOnMount: options.refetchOnMount,
  });
}

/**
 * Total residences matching `query`, for the filters screen's "Show N homes"
 * badge. Keeps the previous count visible while a new one loads so the badge
 * doesn't flicker as filters change (callers debounce the query).
 */
export function useListingsCount(query: ListingQuery = {}) {
  return useQuery({
    queryKey: listingKeys.count(query),
    queryFn: ({ signal }) => getListingsCount(query, signal),
    placeholderData: keepPreviousData,
  });
}

export const areaKeys = {
  all: ['areas'] as const,
  city: (city: string) => ['areas', city] as const,
};

/**
 * Neighborhood boundaries for a city (CBS municipality code), or disabled when
 * `city` is undefined (no city selected → no fetch, empty data). `loader`
 * defaults to the network `getAreas`, but the app passes `loadAreas`, which
 * caches the result in AsyncStorage under the city code — so boundaries survive
 * across launches and the API is hit at most once per city. They never change,
 * so the query also never refetches within a session.
 */
export function useAreas(
  city: string | undefined,
  loader: (city: string) => Promise<AreaPolygon[]> = getAreas,
) {
  return useQuery({
    queryKey: areaKeys.city(city ?? ''),
    queryFn: () => loader(city as string),
    enabled: !!city,
    staleTime: Infinity,
  });
}

export const statsKeys = {
  all: ['stats'] as const,
  city: (city: string) => ['stats', city] as const,
};

/**
 * Neighborhood statistics for a city, matched to areas by `code`, or disabled
 * when `city` is undefined. Like {@link useAreas}, `loader` defaults to the
 * network `getStats` but the app passes `loadStats` for permanent per-city
 * AsyncStorage caching. Static data, so it never refetches within a session.
 */
export function useStats(
  city: string | undefined,
  loader: (city: string) => Promise<NeighborhoodStats[]> = getStats,
) {
  return useQuery({
    queryKey: statsKeys.city(city ?? ''),
    queryFn: () => loader(city as string),
    enabled: !!city,
    staleTime: Infinity,
  });
}

export const cityKeys = {
  all: ['cities'] as const,
};

/**
 * All Dutch municipality boundaries, used to hit-test a tapped map point to its
 * city. `loader` defaults to the network `getCities`; the app passes
 * `loadCities` for permanent AsyncStorage caching. Boundaries never change, so
 * it never refetches within a session.
 */
export function useCities(loader: () => Promise<CityShape[]> = getCities) {
  return useQuery({
    queryKey: cityKeys.all,
    queryFn: loader,
    staleTime: Infinity,
  });
}

export const cityNameKeys = {
  all: ['city-names'] as const,
};

/**
 * All Dutch municipality names (code + name), used by the onboarding city picker
 * and its fuzzy search. `loader` defaults to the network `getCityNames` (which
 * falls back to a bundled sample offline). The list never changes, so it never
 * refetches within a session.
 */
export function useCityNames(loader: () => Promise<CityName[]> = getCityNames) {
  return useQuery({
    queryKey: cityNameKeys.all,
    queryFn: loader,
    staleTime: Infinity,
  });
}

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: listingKeys.detail(id ?? ''),
    queryFn: () => getListing(id as string),
    enabled: !!id,
  });
}
