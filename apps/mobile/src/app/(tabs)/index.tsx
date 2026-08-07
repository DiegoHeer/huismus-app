import { useAreas, useCities, useListings, useStats } from '@huismus/data';
import type { AreaPolygon, Listing, MapBounds } from '@huismus/types';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { areasCenter } from '@/components/area-polygons';
import { AreaSheet } from '@/components/area-sheet';
import { FilterPills } from '@/components/filter-pills';
import { ListingCard } from '@/components/listing-card';
import { ListingMap, type ListingMapRef } from '@/components/listing-map';
import { LocationSearch, type LocationSearchRef } from '@/components/location-search';
import { DEFAULT_CENTER, INITIAL_ZOOM } from '@/components/map-shared';
import { useEffectiveColorScheme } from '@/components/map-style';
import { OverlayLegend } from '@/components/overlay-legend';
import { Brand } from '@/constants/theme';
import { useBrand } from '@/hooks/use-theme';
import { trackOverlayEnabled } from '@/lib/analytics';
import { loadAreas, loadCities, loadStats } from '@/lib/area-cache';
import { colorAreasByStat, rampFor, selectInhabitants, statDomain } from '@/lib/area-choropleth';
import { buildCityIndex, findCityAt } from '@/lib/city-hit-test';
import { countActiveFilters, filtersToQuery, useFilters } from '@/lib/filters';
import { useLikes } from '@/lib/likes';
import { clearMapFocus, useMapFocus } from '@/lib/map-focus';
import { overlayById, type OverlayId } from '@/lib/map-overlays';
import { useMapSettings } from '@/lib/map-settings';
import { normalizeStats } from '@/lib/neighborhood-stats';
import { zoomForType } from '@/lib/pdok';
import { recordRecentView, useRecentViews } from '@/lib/recent-views';
import type { Origin, SearchResult } from '@/lib/search';
import { boundsEqual, quantizeBounds } from '@/lib/viewport';

// Zoom level at or above which the map auto-loads the neighborhoods under its
// centre. The initial framing sits at zoom 11 (no city selected yet); zooming
// past this — roughly a single municipality filling the screen, matching the
// `woonplaats` search zoom in `zoomForType` — loads that city's overlays.
const AUTO_LOAD_AREAS_ZOOM = 12;

// The map search bar draws suggestions from all three sources (homes + buurten +
// places); the explore tab keeps the default places-only bar.
const SEARCH_SOURCES = ['homes', 'buurten', 'places'] as const;

// How long a viewport's homes stay fresh. Quantizing the bbox already makes a
// nudge re-use the previous query key, but without this every pan *back* to a
// rectangle just visited would refetch it — React Query treats a result as stale
// the moment it lands. Panning to and fro around a city is an ordinary gesture,
// and listings don't turn over by the minute, so a couple of minutes of reuse
// costs nothing and saves the whole round trip.
const VIEWPORT_STALE_TIME_MS = 2 * 60 * 1000;

// Stable identity for "no homes yet", so waiting on the first viewport doesn't
// hand `shownListings` a fresh array to re-memoize on every render.
const NO_LISTINGS: Listing[] = [];

export default function MapScreen() {
  const brand = useBrand();
  const { filters } = useFilters();
  const { data: cities = [] } = useCities(loadCities);
  const insets = useSafeAreaInsets();
  const mapRef = useRef<ListingMapRef>(null);
  const searchRef = useRef<LocationSearchRef>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  // Quick-filter chips below the search bar — their own toggle state, separate
  // from the search filters (the filters page drives the map + the count badge).
  const [activeFilters, setActiveFilters] = useState<Set<string>>(() => new Set());
  const toggleFilter = useCallback((key: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  // The Favorites/Recent pills swap the map's data source: instead of the
  // server's search results, show the locally stored snapshots — every liked /
  // recently viewed home, wherever it is, regardless of the current search
  // query (the stores keep whole Listings for exactly this). Both pills
  // together show the union, deduped by id (a home can be both). The camera
  // stays put, matching the rule that selection never pans the map.
  const { likes } = useLikes();
  const { recentViews } = useRecentViews();
  const favoritesActive = activeFilters.has('favorites');
  const recentActive = activeFilters.has('recent');
  const snapshotsActive = favoritesActive || recentActive;
  // The Sold pill takes a different path from the snapshot pills above: instead
  // of swapping the data source, it narrows the *server* query to sold
  // residences (status=sold), so the API returns only sold homes. Filters and
  // sort otherwise drive the query — the server returns only matching, geocoded
  // homes (capped at the page size), which the map renders directly.
  const soldActive = activeFilters.has('sold');
  // The rectangle the residence query is scoped to: the visible viewport,
  // widened and snapped to a grid (see lib/viewport). Null until the map reports
  // its first framing, which it does on load — so the very first fetch is
  // already viewport-scoped rather than a fixed page of the whole country.
  const [viewport, setViewport] = useState<MapBounds | null>(null);
  // Whether the map has reported a camera position at all. The query waits for
  // this rather than for `viewport` itself: if a platform ever fails to report
  // bounds, the map falls back to an unscoped page of homes instead of showing
  // none at all. In the normal case both land in the same render, so the very
  // first request already carries the bbox.
  const [cameraReady, setCameraReady] = useState(false);
  const query = useMemo(() => {
    const base = filtersToQuery(filters);
    return {
      ...base,
      ...(soldActive ? { status: 'sold' as const } : null),
      ...(viewport ? { bbox: viewport } : null),
    };
  }, [filters, soldActive, viewport]);
  // Held until the map reports its camera: without the bbox this would fetch a
  // page of the whole country and then throw it away one render later.
  // `isFetching` covers reloads for a new viewport, where the previous
  // viewport's markers stay on screen (keepPrevious) — distinct from
  // `isLoading`, the first load with nothing to show yet.
  const { data, isLoading, isFetching } = useListings(query, {
    enabled: cameraReady,
    keepPrevious: true,
    staleTime: VIEWPORT_STALE_TIME_MS,
  });
  const listings = data?.listings ?? NO_LISTINGS;
  // A home picked from the search bar. Injected into `shownListings` (deduped) so
  // its marker + card appear even when it's outside the current query/snapshot set.
  const [searchedListing, setSearchedListing] = useState<Listing | null>(null);
  const shownListings = useMemo(() => {
    let base: Listing[];
    if (snapshotsActive) {
      const merged = new Map<string, Listing>();
      if (favoritesActive) for (const listing of likes) merged.set(listing.id, listing);
      if (recentActive) for (const listing of recentViews) merged.set(listing.id, listing);
      base = [...merged.values()];
    } else {
      base = listings;
    }
    if (searchedListing && !base.some((l) => l.id === searchedListing.id)) {
      return [searchedListing, ...base];
    }
    return base;
  }, [snapshotsActive, favoritesActive, recentActive, listings, likes, recentViews, searchedListing]);
  // A residence load is only worth a spinner when the map has nothing to draw.
  // Once there are markers on screen — including the previous viewport's, which
  // `keepPrevious` holds through the fetch — panning refreshes them silently: an
  // overlay thrown over a map the user is still reading costs more than a moment
  // of slightly stale pins. Covers the pre-camera wait too, where the query is
  // disabled and so reports neither `isLoading` nor `isFetching`.
  const residencesLoading =
    !snapshotsActive && shownListings.length === 0 && (!cameraReady || isLoading || isFetching);
  // The active map overlay (noise, air quality, …) — one at a time: tapping an
  // overlay pill swaps to it, tapping the active one turns it off.
  const [overlayId, setOverlayId] = useState<OverlayId | null>(null);
  const toggleOverlay = useCallback(
    (id: OverlayId) => {
      const enabling = overlayId !== id;
      setOverlayId(enabling ? id : null);
      if (enabling) trackOverlayEnabled(id);
    },
    [overlayId],
  );
  const overlay = overlayById(overlayId);
  // Viewport zoom as of the last camera settle — drives the legend's "zoom in"
  // hint for overlays that only render at building-level zooms.
  const [mapZoom, setMapZoom] = useState(INITIAL_ZOOM);
  // Viewport centre as of the last camera settle — the origin the search bar
  // ranks its suggestions against (nearest first). Seeded with the national
  // default and replaced with the real centre once the map reports one.
  const [mapCenter, setMapCenter] = useState<Origin>(DEFAULT_CENTER);
  // No city is selected until the user taps one. Until then the map shows no
  // neighborhoods; tapping a city loads + shows that city's neighborhoods.
  const [selectedCity, setSelectedCity] = useState<
    { code: string; name: string; geometry: AreaPolygon['geometry'] } | null
  >(null);

  const { data: areas = [], isFetching: areasFetching } = useAreas(selectedCity?.code, loadAreas);
  const { data: stats = [] } = useStats(selectedCity?.code, loadStats);

  // 3D buildings preference, set on the Map settings page (see profile.tsx).
  // Toggling it only adds/removes the extrusion layer — the camera keeps
  // whatever pitch the user has set, so there is nothing to drive here.
  const { buildings3D } = useMapSettings();

  // A city chosen during the intro tour, or the first saved preferred city
  // re-queued at boot: once the city shapes are loaded, focus the map on it
  // (fly + select, so its neighborhoods load) and clear the request so it
  // fires only once. Needs the geometry from `cities`, which is empty in
  // mock/offline builds — there the request is simply left unconsumed.
  const pendingFocus = useMapFocus();
  // Consume a one-shot external signal (set when the tour finishes or at boot,
  // before the map mounts) and reflect it into local selection + an imperative
  // camera move.
  // This is the "subscribe to an external system" effect the rule is meant to
  // allow; it just can't see that through the store indirection, so disable it
  // here (cf. hooks/use-color-scheme.web.ts).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!pendingFocus || cities.length === 0) return;
    const city = cities.find((c) => c.code === pendingFocus.code);
    clearMapFocus();
    if (!city) return;
    setSelectedCity({ code: city.code, name: pendingFocus.name, geometry: city.geometry });
    setSelectedAreaId(null);
    setSelectedId(null);
    // `color` is never painted here — areasCenter only reads geometry.
    const center = areasCenter([
      { id: city.code, color: Brand.light.accent, geometry: city.geometry },
    ]);
    if (center) mapRef.current?.flyTo({ ...center, zoom: 11 });
  }, [pendingFocus, cities]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Precompute city bounding boxes once so a tap ray-casts only the polygons
  // whose bbox contains it. Cities load once and are cached, so this is cheap.
  const cityIndex = useMemo(() => buildCityIndex(cities), [cities]);

  // Resolve the selection against what's on the map — a snapshot marker must
  // open its card even when the listing isn't in the server results. A side
  // effect: deselecting happens for free when a toggle removes the marker.
  const selected = useMemo(
    () => shownListings.find((l) => l.id === selectedId) ?? null,
    [shownListings, selectedId],
  );

  const selectedArea = useMemo(
    () => areas.find((a) => a.id === selectedAreaId) ?? null,
    [areas, selectedAreaId],
  );

  // Stats are a separate dataset matched to areas by code (=== the area's id).
  // Normalize on the way in so 2024-vintage records (most neighborhoods outside
  // Den Haag) speak the same field vocabulary as 2023 ones — see normalizeStats.
  const statsByCode = useMemo(
    () => new Map(stats.map((s) => [s.code, normalizeStats(s)])),
    [stats],
  );
  const selectedAreaStats = selectedArea ? statsByCode.get(selectedArea.id) ?? null : null;

  // Shade each neighborhood by its inhabitant count relative to the rest of the
  // municipality: light→dark blue (more = darker) on the light basemap, inverted
  // to brighter = more on the dark one. Recomputed when areas, stats or theme change.
  const scheme = useEffectiveColorScheme();
  const coloredAreas = useMemo(
    () => colorAreasByStat(areas, statsByCode, { scheme }),
    [areas, statsByCode, scheme],
  );

  // Scale legend shown above the area sheet at peek: the municipality-wide
  // inhabitant range the map colors span, plus the ramp for the active theme.
  // Null when there's no spread (single neighborhood or all equal).
  const areaLegend = useMemo(() => {
    const domain = statDomain(areas, statsByCode);
    return domain ? { min: domain.min, max: domain.max, ramp: rampFor(scheme) } : null;
  }, [areas, statsByCode, scheme]);

  // The selected neighborhood's inhabitant count, marked on the legend — read
  // with the same selector the choropleth uses so the marker matches its fill.
  const selectedInhabitants = selectedAreaStats ? selectInhabitants(selectedAreaStats) : null;

  // Once a city's neighborhoods are visible, surface its name in the search
  // placeholder; otherwise the field keeps its default "Search" hint.
  const cityName = selectedCity && areas.length > 0 ? selectedCity.name : undefined;

  // A tapped city's neighborhoods are on their way. Cached cities resolve
  // instantly, so this rarely shows.
  const areasLoading = !!selectedCity && areasFetching;

  // While the tapped city's neighborhoods load, pulse its outline as a loading
  // hint. Cleared the moment they arrive or another city is picked (both flip
  // this back to null), so the overlay never lingers.
  const loadingCityPolygon: AreaPolygon | null =
    areasLoading && selectedCity
      ? { id: selectedCity.code, color: brand.accent, geometry: selectedCity.geometry }
      : null;

  // Selecting a marker shows its preview card, which counts as a view — record
  // it so the pin recolors immediately (the map reads from the same store).
  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      setSelectedAreaId(null);
      const listing = shownListings.find((l) => l.id === id);
      if (listing) recordRecentView(listing);
    },
    [shownListings],
  );

  // Selecting an area and a listing are mutually exclusive — the area sheet and
  // the listing card both anchor to the bottom, so showing one dismisses the other.
  // The camera deliberately stays put — selection must not pan the map.
  const handleSelectPolygon = useCallback((id: string) => {
    setSelectedAreaId(id);
    setSelectedId(null);
  }, []);

  // Find which city a coordinate lands in and switch to it (loading its
  // neighborhoods). A hit on the already-selected city is a no-op (its own
  // overlays handle taps); cities don't overlap, so at most one matches.
  // `deselectListing` (on by default) also clears any selected marker — right
  // for an explicit tap, where picking a city/area and viewing a listing card
  // are mutually exclusive, but wrong for the passive camera-idle auto-load
  // below, which must not clobber a marker the user just flew to on purpose.
  const selectCityAt = useCallback(
    (coord: { longitude: number; latitude: number }, opts: { deselectListing?: boolean } = {}) => {
      const hit = findCityAt([coord.longitude, coord.latitude], cityIndex);
      if (!hit || hit.code === selectedCity?.code) return;
      setSelectedCity({ code: hit.code, name: hit.name, geometry: hit.geometry });
      setSelectedAreaId(null);
      if (opts.deselectListing ?? true) setSelectedId(null);
    },
    [cityIndex, selectedCity],
  );

  // A tap that isn't on a neighborhood overlay falls through to here.
  const handleMapPress = selectCityAt;

  // Once the camera settles, auto-load the neighborhoods under the viewport
  // centre — but only when zoomed in far enough that the user is clearly
  // looking at a single city, as if they'd tapped the middle of the map. Below
  // that zoom we leave it to an explicit tap, so panning the country at a
  // glance doesn't keep swapping cities underfoot. This can fire right after
  // flying to a searched residence (its zoom crosses the threshold), so it
  // must leave the just-selected marker alone.
  //
  // It also reloads the residences for the new viewport: every settle snaps the
  // visible bounds to a grid and, when that lands on a different cell, updates
  // the query — so a pan or zoom loads the homes now on screen. Keeping the
  // previous rectangle when the cell is unchanged is what makes a nudge free: an
  // identical query key is a cache hit, and no state changes, so nothing
  // re-renders. This covers the search bar too — picking a city, buurt or home
  // flies the camera, and the settle that follows loads that area's homes.
  const handleCameraIdle = useCallback(
    ({
      longitude,
      latitude,
      zoom,
      bounds,
    }: {
      longitude: number;
      latitude: number;
      zoom: number;
      bounds?: MapBounds;
    }) => {
      setMapZoom(zoom);
      setMapCenter({ longitude, latitude });
      setCameraReady(true);
      // A null quantization means the map hasn't laid out yet — keep whatever
      // viewport we already had rather than querying a rectangle that is about
      // to be replaced.
      const next = bounds ? quantizeBounds(bounds) : null;
      if (next) setViewport((prev) => (boundsEqual(prev, next) ? prev : next));
      if (zoom < AUTO_LOAD_AREAS_ZOOM) return;
      selectCityAt({ longitude, latitude }, { deselectListing: false });
    },
    [selectCityAt],
  );

  // Picking a search result acts per kind:
  // - place: fly + hit-test the surrounding city (loads its neighborhoods). The
  //   hit-test handles a municipality (gemeente) too, which flies below the
  //   auto-load threshold and so wouldn't otherwise trigger the camera-idle load.
  // - buurt: select its municipality (loading overlays) and target the buurt
  //   polygon so the AreaSheet opens once areas arrive; a wijk (null buurtcode)
  //   has no polygon, so it just flies + loads the city.
  // - residence: inject the home so its marker + card show even when it's outside
  //   the current query page, then select and fly to it.
  const handleSearchResult = useCallback(
    (r: SearchResult) => {
      // A place/buurt pick isn't a home, so drop any home injected by a prior
      // search — otherwise its marker lingers on the map with no way to clear it.
      if (r.kind === 'place') {
        setSearchedListing(null);
        const { longitude, latitude, type } = r.result;
        mapRef.current?.flyTo({ longitude, latitude, zoom: zoomForType(type) });
        selectCityAt({ longitude, latitude });
        return;
      }
      if (r.kind === 'buurt') {
        setSearchedListing(null);
        setSelectedId(null);
        const city = cities.find((c) => c.code === r.gemeentecode);
        if (city) {
          // Select the municipality so its neighborhoods load; the AreaSheet
          // then opens against the matching polygon once they arrive.
          setSelectedCity({ code: city.code, name: city.name, geometry: city.geometry });
          setSelectedAreaId(r.buurtcode);
        } else {
          // City shapes aren't loaded (or the CBS code is unknown), so no
          // overlays will arrive to open the sheet against — fly there without a
          // dangling area selection, same as a wijk (null buurtcode).
          setSelectedAreaId(null);
        }
        mapRef.current?.flyTo({ longitude: r.longitude, latitude: r.latitude, zoom: zoomForType('buurt') });
        return;
      }
      // residence
      setSearchedListing(r.listing);
      setSelectedAreaId(null);
      setSelectedId(r.listing.id);
      recordRecentView(r.listing);
      const { longitude, latitude } = r.listing.location;
      mapRef.current?.flyTo({ longitude, latitude, zoom: 16 });
    },
    [selectCityAt, cities],
  );

  return (
    <View className="flex-1 bg-bg">
      <ListingMap
        ref={mapRef}
        listings={shownListings}
        polygons={coloredAreas}
        onSelect={handleSelect}
        onSelectPolygon={handleSelectPolygon}
        onMapPress={handleMapPress}
        onCameraIdle={handleCameraIdle}
        loadingPolygon={loadingCityPolygon}
        selectedPolygonId={selectedAreaId}
        overlay={overlay}
        buildings3D={buildings3D}
      />
      {/* Full-screen backdrop: while the search is active, a tap anywhere
          outside the field/dropdown collapses it and hides the keyboard.
          Rendered above the map but below the search overlay (which keeps its
          own taps), so only "outside" taps reach it. */}
      {searchActive && (
        <Pressable
          className="absolute inset-0"
          onPress={() => searchRef.current?.dismiss()}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      )}
      <View
        className="absolute inset-x-0 px-4"
        style={{ top: insets.top + 8 }}
        pointerEvents="box-none">
        <LocationSearch
          ref={searchRef}
          sources={SEARCH_SOURCES}
          origin={mapCenter}
          onActiveChange={setSearchActive}
          placeholder={cityName}
          activeFilterCount={countActiveFilters(filters)}
          onOpenFilters={() => router.push('/settings/filters')}
          onResult={handleSearchResult}
        />
        <View className="mt-2">
          <FilterPills
            selected={activeFilters}
            onToggle={toggleFilter}
            activeOverlay={overlayId}
            onToggleOverlay={toggleOverlay}
          />
        </View>
        {/* Legend for the active overlay, explaining the colors it paints. */}
        {overlay && <OverlayLegend overlay={overlay} zoom={mapZoom} />}
        {/* Spinner centered below the pills while a tapped city's neighborhoods
            load. Residences deliberately don't take this slot: reloading them
            for a new viewport happens silently behind the markers already on
            the map (see `residencesLoading`). */}
        {areasLoading && (
          <View
            testID="map-background-loading"
            className="mt-3 self-center rounded-full bg-card p-2.5 shadow-md shadow-black/20"
            pointerEvents="none">
            <ActivityIndicator />
          </View>
        )}
      </View>
      {selected && (
        <View
          className="absolute inset-x-0 px-4"
          style={{ bottom: insets.bottom + 8 }}
          pointerEvents="box-none">
          <ListingCard
            listing={selected}
            onPress={() => router.push({ pathname: '/listing/[id]', params: { id: selected.id } })}
            // A swipe-dismissal reports back only after its exit animation, by
            // which point the user may already have tapped another marker — so
            // clear the selection only if it's still the card that was thrown away.
            onClose={() => setSelectedId((cur) => (cur === selected.id ? null : cur))}
          />
        </View>
      )}
      {/* The only spinner residences get, and only while there is nothing on the
          map to look at instead — the first load, or a pan into an area whose
          predecessor was empty too. */}
      {residencesLoading && (
        <View
          testID="map-initial-loading"
          className="absolute inset-0 items-center justify-center"
          pointerEvents="none">
          <ActivityIndicator />
        </View>
      )}
      {/* Draggable, animated card for a selected area. Rendered in its own Modal
          so it overlays the native tab bar; dragging it off screen deselects. */}
      <AreaSheet
        area={selectedArea}
        stats={selectedAreaStats}
        municipality={selectedCity?.name ?? ''}
        legend={areaLegend ? { ...areaLegend, value: selectedInhabitants } : null}
        onClose={() => setSelectedAreaId(null)}
      />
    </View>
  );
}
