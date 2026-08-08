import type { AreaPolygon, Listing, MapBounds } from '@huismus/types';
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map,
  type MapRef,
  Marker,
  RasterSource,
  VectorSource,
} from '@maplibre/maplibre-react-native';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { MaxFontScale, Text } from '@huismus/ui';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  areasCenter,
  fillOpacityFor,
  outlineWidthFor,
  SELECTED_DASH_ARRAY,
  SELECTED_DASH_COLOR,
  SELECTED_DASH_WIDTH,
  selectedFilter,
  toFeatureCollection,
} from './area-polygons';
import { useMapStyle } from './map-style';
import {
  BUILDINGS_3D_MIN_ZOOM,
  boundsFromTuple,
  buildings3DPaint,
  DEFAULT_CENTER,
  INITIAL_ZOOM,
  PIN_TAIL,
  priceLabel,
  viewedPinFill,
} from './map-shared';
import {
  MARKER_ENTER_MS,
  MARKER_EXIT_MS,
  MARKER_JUMP_PX,
  useMarkerTransitions,
  type MarkerPhase,
} from './marker-transitions';
import { usePulseOpacity } from './use-pulse-opacity';
import { buildAreaIndex, findAreaAt } from '../lib/area-hit-test';
import { outlineColorFor } from '../lib/area-choropleth';
import { type MapOverlay } from '../lib/map-overlays';
import { useRecentViews } from '../lib/recent-views';
import { useBrand } from '@/hooks/use-theme';

// The search bar overlays the top of the map, so park the compass in the
// bottom-left corner instead — clear of both the search field and the listing
// preview card (which spans the bottom but is inset from the left edge).
const COMPASS_MARGIN = 16;

// A marker tap on the native map also fires the map's own tap gesture — the RN
// marker overlay and the native gesture are independent event streams, so both
// land. Within this many ms of a marker tap, treat a map press as part of that
// same gesture and ignore it, so tapping a marker selects the listing without
// also switching municipality. (The web map stops the click from propagating.)
const MARKER_TAP_GRACE_MS = 300;

/**
 * A marker's bubble plus its arrival / departure animation (web mirror: the
 * `hm-marker-in` / `hm-marker-out` keyframes in listing-map.web.tsx).
 *
 * Arriving is a ballistic jump: the pin springs off its anchor, decelerates to
 * the top of the arc, then accelerates back down under "gravity" — which is why
 * the two halves are eased in opposite directions rather than sharing one
 * curve. Opacity runs linearly across the whole hop so the fade lands with it.
 * Leaving is the fade alone; the pin holds its place while it goes.
 */
function MarkerPin({
  phase,
  delay,
  children,
}: {
  phase: MarkerPhase;
  delay: number;
  children: ViewProps['children'];
}) {
  // An arriving pin must be invisible from its very first frame, through the
  // stagger, until its turn comes — otherwise it flashes at full opacity first.
  const opacity = useSharedValue(phase === 'entering' ? 0 : 1);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (phase === 'entering') {
      opacity.value = withDelay(
        delay,
        withTiming(1, { duration: MARKER_ENTER_MS, easing: Easing.linear }),
      );
      lift.value = withDelay(
        delay,
        withSequence(
          withTiming(-MARKER_JUMP_PX, {
            duration: MARKER_ENTER_MS / 2,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(0, { duration: MARKER_ENTER_MS / 2, easing: Easing.in(Easing.quad) }),
        ),
      );
    } else if (phase === 'leaving') {
      opacity.value = withDelay(
        delay,
        withTiming(0, { duration: MARKER_EXIT_MS, easing: Easing.linear }),
      );
    }
  }, [phase, delay, opacity, lift]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: lift.value }],
  }));

  return <Animated.View style={[styles.markerWrap, animatedStyle]}>{children}</Animated.View>;
}

/**
 * The tapped city's own outline, pulsing in opacity while its neighborhoods
 * load. Mounted only during the load (the parent passes null once the data
 * arrives or another city is picked), so the pulse interval lives just that
 * long. Memoizes the feature so each frame changes only the fill opacity, not
 * the source data.
 */
function PulsingCityOverlay({ polygon, beforeId }: { polygon: AreaPolygon; beforeId?: string }) {
  const opacity = usePulseOpacity(true);
  const data = useMemo(() => toFeatureCollection([polygon]), [polygon]);
  return (
    <GeoJSONSource id="loading-city" data={data}>
      <Layer
        id="loading-city-fill"
        type="fill"
        beforeId={beforeId}
        paint={{ 'fill-color': polygon.color, 'fill-opacity': opacity }}
      />
      <Layer
        id="loading-city-outline"
        type="line"
        beforeId={beforeId}
        paint={{ 'line-color': polygon.color, 'line-width': 1.5, 'line-opacity': 0.9 }}
      />
    </GeoJSONSource>
  );
}

export interface ListingMapProps {
  listings: Listing[];
  /** Colored area overlays drawn beneath the markers, each at 50% fill opacity. */
  polygons?: AreaPolygon[];
  onSelect?: (id: string) => void;
  /** Fired with the polygon's id when one of the area overlays is tapped. */
  onSelectPolygon?: (id: string) => void;
  /** Id of the area overlay to highlight (denser fill + bolder outline). */
  selectedPolygonId?: string | null;
  /**
   * Fired with the tapped geographic coordinate for a press that isn't on an
   * area overlay — used to hit-test which city was tapped.
   */
  onMapPress?: (coord: { longitude: number; latitude: number }) => void;
  /**
   * Fired once the camera settles after a pan/zoom, with the viewport centre,
   * zoom and visible bounds. Lets the screen auto-load a city's neighborhoods
   * once the user has zoomed in far enough — as if they'd tapped the middle of
   * the map — and reload the residences that fall inside the new viewport.
   * `bounds` is omitted only if the map cannot report them yet.
   */
  onCameraIdle?: (state: {
    longitude: number;
    latitude: number;
    zoom: number;
    bounds?: MapBounds;
  }) => void;
  /**
   * Camera to open on, in place of the default framing — the view the user left
   * when they switched tabs. Applied once, like every other initial framing
   * here: later camera moves belong to the user's gestures and the imperative
   * ref. Null opens on the default.
   */
  initialCamera?: { longitude: number; latitude: number; zoom: number } | null;
  /**
   * The tapped city's outline, pulsing while its neighborhoods load. Null hides
   * it (data arrived, or no city is loading).
   */
  loadingPolygon?: AreaPolygon | null;
  /**
   * Active data overlay (noise, air quality, energy labels, …) drawn above the
   * basemap's buildings but below its labels. Null shows none.
   */
  overlay?: MapOverlay | null;
  /**
   * Extrude the basemap's buildings to their real height. The camera is left
   * alone — the extrusion is drawn top-down unless the user tilts the map.
   */
  buildings3D?: boolean;
}

/** Imperative handle for driving the camera, e.g. flying to a search result. */
export interface ListingMapRef {
  flyTo: (target: { longitude: number; latitude: number; zoom?: number }) => void;
}

/**
 * Native map (iOS/Android) via MapLibre React Native (v11).
 * Requires a custom dev build — MapLibre's native module is not in Expo Go.
 * The web implementation lives in `listing-map.web.tsx`.
 */
export const ListingMap = forwardRef<ListingMapRef, ListingMapProps>(function ListingMap(
  {
    listings,
    polygons,
    onSelect,
    onSelectPolygon,
    selectedPolygonId,
    onMapPress,
    onCameraIdle,
    initialCamera,
    loadingPolygon,
    overlay,
    buildings3D,
  },
  ref,
) {
  const brand = useBrand();
  const cameraRef = useRef<CameraRef>(null);
  // The region-change event carries the visible bounds, but the initial framing
  // arrives via onDidFinishLoadingMap, which doesn't — so hold a map ref to ask
  // for them once on load.
  const mapViewRef = useRef<MapRef>(null);
  // A flyTo can arrive before the native map has finished loading — the
  // boot-time preferred-city focus fires as soon as the cached city shapes
  // hydrate — and the camera may drop it. Until the map reports loaded, keep
  // the latest target and re-assert it then, instantly: at that point it's the
  // launch framing, not a transition the user should watch.
  const pendingFlyToRef = useRef<{ longitude: number; latitude: number; zoom?: number } | null>(
    null,
  );
  const mapLoadedRef = useRef(false);
  // Timestamp of the last marker tap; see MARKER_TAP_GRACE_MS.
  const markerTapAtRef = useRef(0);
  const insets = useSafeAreaInsets();
  const { mapStyle, polygonsBeforeId, overlayBeforeId, scheme } = useMapStyle();
  // Already-seen listings swap fill colour — never opacity, and never a
  // translucent fill. Both would let the basemap through, which changes what
  // "seen" looks like from one tile to the next; a solid taupe reads the same
  // everywhere. Keeping it off `opacity` also leaves the white outline and the
  // price label at full strength — they are what make a pin readable over
  // arbitrary tiles — and stops the bubble and its tail double-blending where
  // they overlap, which `markerArrow`'s -1px tuck exists to hide.
  const viewedFill = viewedPinFill(scheme);
  const { recentViews } = useRecentViews();
  const viewedIds = useMemo(
    () => new Set(recentViews.map((listing) => listing.id)),
    [recentViews],
  );
  // Homes gained and lost since the last set, so each pin knows how to arrive or
  // leave. Includes pins already gone from the data but still fading out.
  const markers = useMarkerTransitions(listings);

  useImperativeHandle(ref, () => ({
    flyTo: (target) => {
      if (!mapLoadedRef.current) pendingFlyToRef.current = target;
      cameraRef.current?.flyTo({
        center: [target.longitude, target.latitude],
        zoom: target.zoom,
        duration: 1200,
      });
    },
  }));

  // Prefer framing the polygons (the map's overlay focus); fall back to the
  // first listing, then a sensible default. Memoized — the bbox scan is O(verts).
  const center = useMemo<[number, number]>(() => {
    const area = polygons && polygons.length > 0 ? areasCenter(polygons) : null;
    if (area) return [area.longitude, area.latitude];
    const first = listings[0]?.location;
    return first ? [first.longitude, first.latitude] : [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude];
  }, [polygons, listings]);

  // Bounding boxes for resolving a tap to the neighborhood actually under the
  // finger — the native press event's own `features` can't do it (see
  // `area-hit-test.ts`). Rebuilt only when the overlay set or its colors change.
  const areaIndex = useMemo(() => buildAreaIndex(polygons ?? []), [polygons]);

  // True for the press a marker tap fires underneath itself (see
  // markerTapAtRef). Guards both the map's handler and the area overlay's, so a
  // marker tap neither switches municipality nor selects the buurt below it.
  const withinMarkerGrace = useCallback(
    () => Date.now() - markerTapAtRef.current < MARKER_TAP_GRACE_MS,
    [],
  );

  // A press on the bare map: hit-test it against the cities. Shared by the map's
  // own handler and the area source's fall-through.
  const pressMap = useCallback(
    (lngLat: [number, number]) => onMapPress?.({ longitude: lngLat[0], latitude: lngLat[1] }),
    [onMapPress],
  );

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={mapStyle}
      // A press not consumed by an area overlay falls through to here; hit-test
      // it against the cities. `lngLat` is a [longitude, latitude] tuple.
      onPress={(e) => {
        if (withinMarkerGrace()) return;
        pressMap(e.nativeEvent.lngLat);
      }}
      ref={mapViewRef}
      // Once a pan/zoom settles, report the viewport centre, zoom and bounds so
      // the screen can auto-load a city's neighborhoods when zoomed in far
      // enough, and reload the residences inside the new viewport.
      onRegionDidChange={(e) => {
        const { center: regionCenter, zoom, bounds } = e.nativeEvent;
        const [longitude, latitude] = regionCenter;
        onCameraIdle?.({
          longitude,
          latitude,
          zoom,
          bounds: bounds ? boundsFromTuple(bounds) : undefined,
        });
      }}
      onDidFinishLoadingMap={async () => {
        mapLoadedRef.current = true;
        const target = pendingFlyToRef.current;
        pendingFlyToRef.current = null;
        // Apply the pending boot-time focus target, if there is one. That jump
        // is itself a camera move, so it fires `onRegionDidChange` with the
        // settled bounds — reporting here as well would only add a query for
        // the pre-jump framing, thrown away a moment later. Let the region
        // change be the first report instead.
        if (target) {
          cameraRef.current?.flyTo({
            center: [target.longitude, target.latitude],
            zoom: target.zoom,
            duration: 0,
          });
          return;
        }
        // No jump pending, so this is the framing the user will actually see:
        // report it, giving the search bar a centre to rank suggestions against
        // and the screen a viewport to load residences for before the first
        // gesture. Bounds don't come with this event, so ask the map for them.
        const bounds = await mapViewRef.current?.getBounds?.();
        onCameraIdle?.({
          longitude: initialCamera?.longitude ?? center[0],
          latitude: initialCamera?.latitude ?? center[1],
          zoom: initialCamera?.zoom ?? INITIAL_ZOOM,
          bounds: bounds ? boundsFromTuple(bounds) : undefined,
        });
      }}
      compassPosition={{
        bottom: insets.bottom + COMPASS_MARGIN,
        left: COMPASS_MARGIN,
      }}>
      {/* Uncontrolled initial framing only: applied once on load. Camera moves
          are then driven solely by the user's gestures and the imperative ref
          (search flyTo) — loading a tapped city's neighborhoods, selecting an
          area, or toggling 3D buildings must not move it. `initialCamera`
          restores the view a tab switch unmounted, so returning opens where the
          user left rather than back at the default framing. */}
      <Camera
        ref={cameraRef}
        initialViewState={
          initialCamera
            ? { center: [initialCamera.longitude, initialCamera.latitude], zoom: initialCamera.zoom }
            : { center, zoom: INITIAL_ZOOM }
        }
      />
      {buildings3D && (
        <Layer
          id="buildings-3d"
          source="openmaptiles"
          source-layer="building"
          type="fill-extrusion"
          minzoom={BUILDINGS_3D_MIN_ZOOM}
          paint={buildings3DPaint(scheme)}
        />
      )}
      {/* Active data overlay. Source/layer ids are unique per overlay: the new
          overlay's layer can be created before the old source is torn down — a
          shared id would attach it to the outgoing source (or update that
          source in place with mismatched type/zoom bounds). */}
      {overlay && overlay.kind === 'raster' && (
        <RasterSource
          key={overlay.id}
          id={`overlay-${overlay.id}`}
          tiles={overlay.tiles}
          tileSize={512}
          minzoom={overlay.minzoom}
          maxzoom={overlay.maxzoom}>
          <Layer
            id={`overlay-${overlay.id}-raster`}
            type="raster"
            beforeId={overlayBeforeId}
            paint={{ 'raster-opacity': overlay.opacity }}
          />
        </RasterSource>
      )}
      {overlay && overlay.kind === 'buildings' && (
        <VectorSource
          key={overlay.id}
          id={`overlay-${overlay.id}`}
          tiles={overlay.tiles}
          minzoom={overlay.minzoom}
          maxzoom={overlay.maxzoom}>
          <Layer
            id={`overlay-${overlay.id}-buildings`}
            type="fill"
            source-layer={overlay.sourceLayer}
            beforeId={overlayBeforeId}
            paint={{ 'fill-color': overlay.fillColor, 'fill-opacity': overlay.opacity }}
          />
        </VectorSource>
      )}
      {loadingPolygon && <PulsingCityOverlay polygon={loadingPolygon} beforeId={polygonsBeforeId} />}
      {polygons && polygons.length > 0 && (
        <GeoJSONSource
          id="area-polygons"
          data={toFeatureCollection(polygons)}
          // Resolve the tap from its coordinate, NOT from `features`: the native
          // hit test returns every feature within a 44 pt/dp box of the touch,
          // in render order, so `features[0]` is an arbitrary neighbor — visibly
          // so when zoomed out, where that box spans several buurten. See
          // `area-hit-test.ts`. A tap inside the box but outside every
          // neighborhood is a press on the bare map, matching web's behavior.
          onPress={(e) => {
            if (withinMarkerGrace()) return;
            const { lngLat } = e.nativeEvent;
            const id = findAreaAt(lngLat, areaIndex);
            if (id) {
              onSelectPolygon?.(id);
              return;
            }
            pressMap(lngLat);
          }}>
          <Layer
            id="area-polygons-fill"
            type="fill"
            beforeId={polygonsBeforeId}
            paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': fillOpacityFor(selectedPolygonId) }}
          />
          <Layer
            id="area-polygons-outline"
            type="line"
            beforeId={polygonsBeforeId}
            paint={{ 'line-color': outlineColorFor(scheme), 'line-width': outlineWidthFor(selectedPolygonId) }}
          />
          {selectedPolygonId && (
            <Layer
              id="area-polygons-selected"
              type="line"
              beforeId={polygonsBeforeId}
              filter={selectedFilter(selectedPolygonId)}
              paint={{
                'line-color': SELECTED_DASH_COLOR,
                'line-width': SELECTED_DASH_WIDTH,
                'line-dasharray': SELECTED_DASH_ARRAY,
              }}
            />
          )}
        </GeoJSONSource>
      )}
      {markers.map(({ listing, phase, delay }) => {
        const fill = viewedIds.has(listing.id) ? viewedFill : brand.accent;
        return (
          <Marker
            key={listing.id}
            id={listing.id}
            lngLat={[listing.location.longitude, listing.location.latitude]}
            // Anchor the tip of the pin tail (the marker's bottom-centre) on the
            // coordinate, so the bubble reads as a pin pointing at the listing.
            anchor="bottom"
            // Use the Marker's own onPress rather than a nested Pressable: a
            // Pressable inside a Marker (MarkerView) does not fire onPress
            // reliably on Android. https://github.com/maplibre/maplibre-react-native/issues/1018
            onPress={() => {
              // A pin on its way out is a leftover, not a target.
              if (phase === 'leaving') return;
              markerTapAtRef.current = Date.now();
              onSelect?.(listing.id);
            }}>
            <MarkerPin phase={phase} delay={delay}>
              <View style={[styles.marker, { backgroundColor: fill }]}>
                <Text
                  style={styles.markerText}
                  numberOfLines={1}
                  // The bubble's tail and outline are drawn to a fixed size, so
                  // the label can't take the body cap.
                  maxFontSizeMultiplier={MaxFontScale.fixed}>
                  {priceLabel(listing)}
                </Text>
              </View>
              <View style={styles.markerArrowWrap}>
                <View style={styles.markerArrowOutline} />
                <View style={[styles.markerArrowFill, { borderTopColor: fill }]} />
              </View>
            </MarkerPin>
          </Marker>
        );
      })}
    </Map>
  );
});

const styles = StyleSheet.create({
  // Stack the bubble over its tail and centre them, so the tail points straight
  // down from the middle of the bubble.
  markerWrap: {
    alignItems: 'center',
  },
  marker: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  // Downward triangle tail that turns the bubble into a pin, drawn as a white
  // triangle with the fill laid over it so the bubble's outline carries on
  // around the point (see PIN_TAIL). Sized to the white one, since that is the
  // larger. Pulled up 1px so it tucks under the bubble's white border: the
  // outline meets white-on-white, leaving no seam between the two.
  markerArrowWrap: {
    width: (PIN_TAIL.halfWidth + PIN_TAIL.border) * 2,
    height: PIN_TAIL.height + PIN_TAIL.border,
    marginTop: -1,
  },
  markerArrowOutline: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    borderLeftWidth: PIN_TAIL.halfWidth + PIN_TAIL.border,
    borderRightWidth: PIN_TAIL.halfWidth + PIN_TAIL.border,
    borderTopWidth: PIN_TAIL.height + PIN_TAIL.border,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ffffff',
  },
  // Inset by the outline's width, so the white shows evenly down both slopes.
  markerArrowFill: {
    position: 'absolute',
    top: 0,
    left: PIN_TAIL.border,
    width: 0,
    height: 0,
    borderLeftWidth: PIN_TAIL.halfWidth,
    borderRightWidth: PIN_TAIL.halfWidth,
    borderTopWidth: PIN_TAIL.height,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  markerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
