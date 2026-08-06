import type { AreaPolygon, Listing } from '@huismus/types';
import { render } from '@testing-library/react-native';

import { ListingMap } from '@/components/listing-map';

// The global mock renders GeoJSONSource/Marker as bare children, dropping their
// props. Re-mock here so the press handlers are callable.
const sourceProps: Record<string, any>[] = [];
const markerProps: Record<string, any>[] = [];
const mapProps: Record<string, any>[] = [];
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Map: ({ children, ...props }: any) => {
      mapProps.push(props);
      return React.createElement(View, { testID: 'maplibre-map' }, children);
    },
    Camera: () => null,
    Marker: ({ children, ...props }: any) => {
      markerProps.push(props);
      return children;
    },
    GeoJSONSource: ({ children, ...props }: any) => {
      sourceProps.push(props);
      return children;
    },
    RasterSource: ({ children }: any) => children,
    VectorSource: ({ children }: any) => children,
    Layer: () => null,
  };
});

function box(id: string, minLng: number, minLat: number, maxLng: number, maxLat: number): AreaPolygon {
  return {
    id,
    name: id,
    color: '#ff0000',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat],
        ],
      ],
    },
  };
}

// Neighbours sharing the border at lng 4.1, as buurten always do.
const WEST = box('BU0001', 4.0, 52.0, 4.1, 52.1);
const EAST = box('BU0002', 4.1, 52.0, 4.2, 52.1);

/**
 * A native press event. `features` deliberately lists the *wrong* neighbour
 * first: that's what MapLibre's 44 pt/dp hitbox query returns near a border, and
 * trusting its order is the bug this suite guards.
 */
function pressEvent(lngLat: [number, number], features: AreaPolygon[] = [EAST, WEST]) {
  return {
    nativeEvent: {
      lngLat,
      point: [0, 0],
      features: features.map((f) => ({
        type: 'Feature',
        properties: { id: f.id, name: f.name, color: f.color },
        geometry: f.geometry,
      })),
    },
  } as never;
}

const LISTING: Listing = {
  id: 'listing-1',
  location: { longitude: 4.05, latitude: 52.05 },
} as Listing;

beforeEach(() => {
  sourceProps.length = 0;
  markerProps.length = 0;
  mapProps.length = 0;
});

describe('ListingMap area press', () => {
  it('selects the neighborhood containing the tap, not features[0]', async () => {
    const onSelectPolygon = jest.fn();
    await render(
      <ListingMap listings={[]} polygons={[WEST, EAST]} onSelectPolygon={onSelectPolygon} />,
    );

    const source = sourceProps.at(-1);
    expect(source?.onPress).toBeInstanceOf(Function);

    // Just inside WEST — features[0] says EAST.
    source!.onPress(pressEvent([4.0999, 52.05]));
    expect(onSelectPolygon).toHaveBeenCalledWith('BU0001');

    // Just inside EAST — features[0] says EAST too, but for the right reason now.
    onSelectPolygon.mockClear();
    source!.onPress(pressEvent([4.1001, 52.05], [WEST, EAST]));
    expect(onSelectPolygon).toHaveBeenCalledWith('BU0002');
  });

  it('falls through to a map press when the tap is outside every neighborhood', async () => {
    const onSelectPolygon = jest.fn();
    const onMapPress = jest.fn();
    await render(
      <ListingMap
        listings={[]}
        polygons={[WEST, EAST]}
        onSelectPolygon={onSelectPolygon}
        onMapPress={onMapPress}
      />,
    );

    // Within the native hitbox of WEST's edge, but outside the shape itself.
    sourceProps.at(-1)!.onPress(pressEvent([3.999, 52.05]));

    expect(onSelectPolygon).not.toHaveBeenCalled();
    expect(onMapPress).toHaveBeenCalledWith({ longitude: 3.999, latitude: 52.05 });
  });

  it('ignores the press a marker tap fires underneath itself', async () => {
    const onSelect = jest.fn();
    const onSelectPolygon = jest.fn();
    const onMapPress = jest.fn();
    await render(
      <ListingMap
        listings={[LISTING]}
        polygons={[WEST, EAST]}
        onSelect={onSelect}
        onSelectPolygon={onSelectPolygon}
        onMapPress={onMapPress}
      />,
    );

    // Tapping a marker also fires the underlying press on native; selecting the
    // listing must not additionally select the buurt beneath it.
    markerProps.at(-1)!.onPress();
    expect(onSelect).toHaveBeenCalledWith('listing-1');

    sourceProps.at(-1)!.onPress(pressEvent([4.05, 52.05]));
    expect(onSelectPolygon).not.toHaveBeenCalled();
    expect(onMapPress).not.toHaveBeenCalled();
  });

  it('hit-tests the bare map press against the tapped coordinate', async () => {
    const onMapPress = jest.fn();
    await render(<ListingMap listings={[]} onMapPress={onMapPress} />);

    mapProps.at(-1)!.onPress(pressEvent([4.3, 52.3], []));
    expect(onMapPress).toHaveBeenCalledWith({ longitude: 4.3, latitude: 52.3 });
  });
});
