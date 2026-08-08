import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';

import { useMapStyle } from './map-style';
import { useBrand } from '@/hooks/use-theme';

export interface LocationMapProps {
  latitude: number;
  longitude: number;
  /** Closer is more "where exactly"; the default frames the street. */
  zoom?: number;
  /**
   * MapLibre style URL or inline style spec. Defaults to whatever the map tab is
   * drawing — the basemap family chosen in Settings → Map, at the app's theme —
   * so a listing's preview is never a different-looking map from the main one.
   */
  mapStyle?: string | StyleSpecification;
  /** Allow pan/zoom gestures. Off by default so it reads as a static thumbnail. */
  interactive?: boolean;
}

/**
 * Native (iOS/Android) static preview map: a single pin centered on a point,
 * with gestures disabled so it reads as a thumbnail rather than a map you pan.
 * The web implementation lives in `location-map.web.tsx`.
 */
export function LocationMap({
  latitude,
  longitude,
  zoom = 14,
  mapStyle,
  interactive = false,
}: LocationMapProps) {
  const brand = useBrand();
  const { mapStyle: appBasemap } = useMapStyle();
  const style = mapStyle ?? appBasemap;
  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={style}
      // Render into a TextureView, not the default GLSurfaceView. A SurfaceView
      // punches a separate window through the view tree: it ignores the parent's
      // rounded corners / overflow clipping and composites poorly inside a
      // ScrollView, which leaves the map blank here. TextureView lives in the
      // normal hierarchy, so it scrolls, clips, and rounds correctly.
      androidView="texture"
      dragPan={interactive}
      touchZoom={interactive}
      doubleTapZoom={interactive}
      touchRotate={interactive}
      touchPitch={interactive}
      attribution={false}
      logo={false}
      compass={false}>
      <Camera center={[longitude, latitude]} zoom={zoom} />
      <Marker id="object" lngLat={[longitude, latitude]}>
        <View style={[styles.pin, { backgroundColor: brand.accent }]} />
      </Marker>
    </Map>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
