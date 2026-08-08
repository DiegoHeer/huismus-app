import 'maplibre-gl/dist/maplibre-gl.css';

import type { AreaPolygon, MapBounds } from '@huismus/types';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { Layer, Map, type MapRef, Marker, Source, useMap } from 'react-map-gl/maplibre';

import type { MapOverlay } from '../lib/map-overlays';

import type { ListingMapProps, ListingMapRef } from './listing-map';
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
import { resolveAnchor, useMapStyle } from './map-style';
import {
  BUILDINGS_3D_MIN_ZOOM,
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
import { outlineColorFor } from '../lib/area-choropleth';
import { useRecentViews } from '../lib/recent-views';
import { useBrand } from '@/hooks/use-theme';

/**
 * Entrance and exit keyframes for the markers. The entrance is a ballistic
 * jump: the pin springs off its anchor, decelerates to the top of the arc, then
 * accelerates back down under "gravity" — hence the two easings, `ease-out` up
 * and `ease-in` down. Opacity runs linearly across the whole thing, so the fade
 * and the hop finish together.
 *
 * Injected into the document rather than written inline because CSS keyframes
 * have no inline form; every marker then just names the animation.
 */
const MARKER_KEYFRAMES = `
@keyframes hm-marker-in {
  0%   { opacity: 0; transform: translateY(0); animation-timing-function: ease-out; }
  50%  { opacity: 0.5; transform: translateY(-${MARKER_JUMP_PX}px); animation-timing-function: ease-in; }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes hm-marker-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
`;

const MARKER_KEYFRAMES_ID = 'hm-marker-keyframes';

/** Add the keyframes to the document once, however many maps mount. */
function useMarkerKeyframes() {
  useEffect(() => {
    if (document.getElementById(MARKER_KEYFRAMES_ID)) return;
    const style = document.createElement('style');
    style.id = MARKER_KEYFRAMES_ID;
    style.textContent = MARKER_KEYFRAMES;
    document.head.appendChild(style);
  }, []);
}

/**
 * The `animation` shorthand for a marker's phase. `both` fill matters in both
 * directions: it holds an arriving pin invisible through its stagger (otherwise
 * it would sit at full opacity until its turn came) and holds a departing one
 * at zero once done, until the hook unmounts it.
 */
function markerAnimation(phase: MarkerPhase, delay: number): string | undefined {
  if (phase === 'steady') return undefined;
  const entering = phase === 'entering';
  const name = entering ? 'hm-marker-in' : 'hm-marker-out';
  const duration = entering ? MARKER_ENTER_MS : MARKER_EXIT_MS;
  return `${name} ${duration}ms linear ${delay}ms both`;
}

/**
 * The tapped city's outline, pulsing in opacity while its neighborhoods load
 * (web mirror of the native overlay). Mounted only during the load; memoizes
 * the feature so each frame changes only the fill opacity, not the source data.
 */
function PulsingCityOverlay({ polygon, beforeId }: { polygon: AreaPolygon; beforeId?: string }) {
  const opacity = usePulseOpacity(true);
  const data = useMemo(() => toFeatureCollection([polygon]), [polygon]);
  return (
    <Source id="loading-city" type="geojson" data={data}>
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
    </Source>
  );
}

/**
 * The active data overlay's source + layer. A separate component so it can
 * resolve the `beforeId` anchor against the *live* style: each theme's anchor
 * only exists in its own style document, and on a theme switch React renders
 * the new anchor id while the map still shows the outgoing style —
 * react-map-gl would `moveLayer` straight to the missing anchor, an error.
 * Instead the anchor is passed only once `getLayer` finds it; during the swap
 * the layer floats unanchored (a legal move to top, invisible under the full
 * style reload) and re-anchors on the `styledata` the new style fires.
 * Source/layer ids are unique per overlay: the new overlay's layer is created
 * during render, before the old source's cleanup runs — a shared id would
 * attach it to the outgoing source (or update that source in place with
 * mismatched type/zoom bounds).
 */
function DataOverlay({ overlay, anchor }: { overlay: MapOverlay; anchor: string }) {
  const { current: map } = useMap();
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!map) return;
    map.on('styledata', bump);
    return () => {
      map.off('styledata', bump);
    };
  }, [map]);
  const beforeId = map?.getLayer(anchor) ? anchor : undefined;

  if (overlay.kind === 'raster') {
    return (
      <Source
        key={overlay.id}
        id={`overlay-${overlay.id}`}
        type="raster"
        tiles={overlay.tiles}
        tileSize={512}
        minzoom={overlay.minzoom}
        maxzoom={overlay.maxzoom}>
        <Layer
          id={`overlay-${overlay.id}-raster`}
          type="raster"
          beforeId={beforeId}
          paint={{ 'raster-opacity': overlay.opacity }}
        />
      </Source>
    );
  }
  return (
    <Source
      key={overlay.id}
      id={`overlay-${overlay.id}`}
      type="vector"
      tiles={overlay.tiles}
      minzoom={overlay.minzoom}
      maxzoom={overlay.maxzoom}>
      <Layer
        id={`overlay-${overlay.id}-buildings`}
        type="fill"
        source-layer={overlay.sourceLayer}
        beforeId={beforeId}
        paint={{ 'fill-color': overlay.fillColor, 'fill-opacity': overlay.opacity }}
      />
    </Source>
  );
}

/**
 * The map's visible bounds, in the named form the listings query takes. MapLibre
 * GL JS returns a `LngLatBounds` object here (the native SDK reports a tuple —
 * see `boundsFromTuple`).
 */
function webBounds(map: {
  getBounds: () => {
    getWest: () => number;
    getSouth: () => number;
    getEast: () => number;
    getNorth: () => number;
  };
}): MapBounds {
  const bounds = map.getBounds();
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}

/** Web map via react-map-gl (MapLibre GL JS). Selected by Metro on web. */
export const ListingMap = forwardRef<ListingMapRef, ListingMapProps>(function ListingMap(
  {
    listings,
    polygons,
    onSelect,
    onSelectPolygon,
    selectedPolygonId,
    onMapPress,
    onCameraIdle,
    loadingPolygon,
    overlay,
    buildings3D,
  },
  ref,
) {
  const brand = useBrand();
  const mapRef = useRef<MapRef | null>(null);
  const { mapStyle, polygonsBeforeId, overlayBeforeId, scheme } = useMapStyle();
  // A different colour, not a faded one — see listing-map.tsx.
  const viewedFill = viewedPinFill(scheme);
  // Layer ids of the style that's actually loaded, so the polygon anchor can
  // be checked against it rather than trusted — see `resolveAnchor`. Kept as a
  // joined key so a repeated `styledata` event (they fire as sources settle,
  // not just on load) doesn't hand back a fresh Set and re-render on every one.
  const [styleLayerKey, setStyleLayerKey] = useState<string | null>(null);
  const polygonsAnchor = useMemo(
    () =>
      resolveAnchor(
        polygonsBeforeId,
        styleLayerKey === null ? null : new Set(styleLayerKey.split(' ')),
      ),
    [polygonsBeforeId, styleLayerKey],
  );
  const { recentViews } = useRecentViews();
  const viewedIds = useMemo(
    () => new Set(recentViews.map((listing) => listing.id)),
    [recentViews],
  );
  // Homes gained and lost since the last set, so each pin knows how to arrive or
  // leave. Includes pins already gone from the data but still fading out.
  const markers = useMarkerTransitions(listings);
  useMarkerKeyframes();

  // A flyTo can arrive before react-map-gl has attached the map instance — the
  // boot-time preferred-city focus fires as soon as the cached city shapes
  // hydrate, which beats the map's creation. Hold the latest target and apply
  // it the moment the instance lands, as an instant jump: at that point it's
  // the launch framing, not a transition the user should watch.
  const pendingFlyToRef = useRef<{ longitude: number; latitude: number; zoom?: number } | null>(
    null,
  );
  const attachMap = useCallback((instance: MapRef | null) => {
    mapRef.current = instance;
    const target = pendingFlyToRef.current;
    if (!instance || !target) return;
    pendingFlyToRef.current = null;
    instance.jumpTo({ center: [target.longitude, target.latitude], zoom: target.zoom });
  }, []);

  useImperativeHandle(ref, () => ({
    flyTo: (target) => {
      const map = mapRef.current;
      if (!map) {
        pendingFlyToRef.current = target;
        return;
      }
      map.flyTo({ center: [target.longitude, target.latitude], zoom: target.zoom, duration: 1200 });
    },
  }));

  // Prefer framing the polygons (the map's overlay focus); fall back to the
  // first listing, then a sensible default. Memoized — the bbox scan is O(verts).
  const center = useMemo(() => {
    const area = polygons && polygons.length > 0 ? areasCenter(polygons) : null;
    if (area) return area;
    const first = listings[0]?.location;
    return first ? { longitude: first.longitude, latitude: first.latitude } : DEFAULT_CENTER;
  }, [polygons, listings]);

  return (
    <Map
      ref={attachMap}
      initialViewState={{ ...center, zoom: INITIAL_ZOOM }}
      mapStyle={mapStyle}
      // Swap themes with a full style reload, not a diff. Diffing races the
      // runtime-added overlay: it tries to move the overlay layer to the new
      // theme's beforeId anchor (which doesn't exist in the old style) and to
      // remove the overlay source before the layer using it. The two vendored
      // themes are entirely different documents, so a diff saves nothing; on
      // reload react-map-gl re-adds the overlay components cleanly.
      styleDiffing={false}
      style={{ width: '100%', height: '100%' }}
      interactiveLayerIds={polygons && polygons.length > 0 ? ['area-polygons-fill'] : []}
      // Report the initial framing once the map loads, so the search bar has a
      // centre to rank suggestions against — and the screen a viewport to load
      // residences for — before the user moves the map.
      onLoad={(e) => {
        const center = e.target.getCenter();
        onCameraIdle?.({
          longitude: center.lng,
          latitude: center.lat,
          zoom: e.target.getZoom(),
          bounds: webBounds(e.target),
        });
      }}
      // Fires on the initial load and again after every style swap (basemap
      // family or theme), which is exactly when the anchors need re-checking.
      onStyleData={(e) => {
        const ids = (e.target.getStyle()?.layers ?? []).map((layer) => layer.id).join(' ');
        setStyleLayerKey((prev) => (prev === ids ? prev : ids));
      }}
      // Once a pan/zoom settles, report the viewport centre, zoom and bounds so
      // the screen can auto-load a city's neighborhoods when zoomed in far
      // enough, and reload the residences inside the new viewport.
      onMoveEnd={(e) => {
        const { longitude, latitude, zoom } = e.viewState;
        onCameraIdle?.({ longitude, latitude, zoom, bounds: webBounds(e.target) });
      }}
      onClick={(e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === 'string') {
          onSelectPolygon?.(id);
          return;
        }
        // A click off any area overlay → hit-test which city it lands in.
        onMapPress?.({ longitude: e.lngLat.lng, latitude: e.lngLat.lat });
      }}>
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
      {/* DataOverlay resolves this against the live style itself — it has to
          re-anchor mid-swap, when React already holds the incoming style's id
          but the map still shows the outgoing one. */}
      {overlay && <DataOverlay overlay={overlay} anchor={overlayBeforeId} />}
      {loadingPolygon && <PulsingCityOverlay polygon={loadingPolygon} beforeId={polygonsAnchor} />}
      {polygons && polygons.length > 0 && (
        <Source id="area-polygons" type="geojson" data={toFeatureCollection(polygons)}>
          <Layer
            id="area-polygons-fill"
            type="fill"
            beforeId={polygonsAnchor}
            paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': fillOpacityFor(selectedPolygonId) }}
          />
          <Layer
            id="area-polygons-outline"
            type="line"
            beforeId={polygonsAnchor}
            paint={{ 'line-color': outlineColorFor(scheme), 'line-width': outlineWidthFor(selectedPolygonId) }}
          />
          {selectedPolygonId && (
            <Layer
              id="area-polygons-selected"
              type="line"
              beforeId={polygonsAnchor}
              filter={selectedFilter(selectedPolygonId)}
              paint={{
                'line-color': SELECTED_DASH_COLOR,
                'line-width': SELECTED_DASH_WIDTH,
                'line-dasharray': SELECTED_DASH_ARRAY,
              }}
            />
          )}
        </Source>
      )}
      {markers.map(({ listing, phase, delay }) => {
        const fill = viewedIds.has(listing.id) ? viewedFill : brand.accent;
        const leaving = phase === 'leaving';
        return (
          <Marker
            key={listing.id}
            longitude={listing.location.longitude}
            latitude={listing.location.latitude}
            // Anchor the marker's bottom-centre (the pin tail's tip) on the
            // coordinate, so the bubble reads as a pin pointing at the listing.
            anchor="bottom"
            onClick={(e) => {
              // A marker click otherwise bubbles up to the map's onClick, which
              // hit-tests the point to a city and switches municipality. Stop it
              // so tapping a marker only selects the listing. (Native suppresses
              // the map press for marker taps itself; this is the web equivalent.)
              e.originalEvent.stopPropagation();
              if (!leaving) onSelect?.(listing.id);
            }}>
            <div
              // Touch devices don't reliably fire the Marker's click handler;
              // handle the tap explicitly. stopPropagation keeps it off the map's
              // press handler (so no municipality switch); preventDefault stops the
              // follow-up synthetic click from double-selecting the listing.
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (!leaving) onSelect?.(listing.id);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                touchAction: 'manipulation',
                animation: markerAnimation(phase, delay),
                // A pin on its way out is a leftover, not a target: it must not
                // swallow a click meant for the map or a marker beneath it.
                pointerEvents: leaving ? 'none' : undefined,
              }}>
              <div
                style={{
                  background: fill,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: 999,
                  border: '1px solid #fff',
                  whiteSpace: 'nowrap',
                }}>
                {priceLabel(listing)}
              </div>
              {/* Downward triangle tail that turns the bubble into a pin, drawn
                  as a white triangle with the fill laid over it so the bubble's
                  outline carries on around the point (see PIN_TAIL). Pulled up
                  1px so it tucks under the bubble's white border: the outline
                  meets white-on-white, leaving no seam between the two. */}
              <div
                style={{
                  position: 'relative',
                  width: (PIN_TAIL.halfWidth + PIN_TAIL.border) * 2,
                  height: PIN_TAIL.height + PIN_TAIL.border,
                  marginTop: -1,
                }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 0,
                    height: 0,
                    borderLeft: `${PIN_TAIL.halfWidth + PIN_TAIL.border}px solid transparent`,
                    borderRight: `${PIN_TAIL.halfWidth + PIN_TAIL.border}px solid transparent`,
                    borderTop: `${PIN_TAIL.height + PIN_TAIL.border}px solid #fff`,
                  }}
                />
                {/* Inset by the outline's width, so the white shows evenly
                    down both slopes. */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: PIN_TAIL.border,
                    width: 0,
                    height: 0,
                    borderLeft: `${PIN_TAIL.halfWidth}px solid transparent`,
                    borderRight: `${PIN_TAIL.halfWidth}px solid transparent`,
                    borderTop: `${PIN_TAIL.height}px solid ${fill}`,
                  }}
                />
              </div>
            </div>
          </Marker>
        );
      })}
    </Map>
  );
});
