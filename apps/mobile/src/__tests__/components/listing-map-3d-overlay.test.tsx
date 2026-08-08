import { render } from '@testing-library/react-native';

import { ListingMap } from '@/components/listing-map';
import { overlayById, type OverlayId } from '@/lib/map-overlays';

// The global mock in test-setup renders Layer as null, which drops its props.
// Re-mock the module here so the mounted layer ids are inspectable.
const mockLayerProps: Record<string, unknown>[] = [];
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Map: ({ children, ...props }: any) =>
      React.createElement(View, { testID: 'maplibre-map', ...props }, children),
    Camera: () => null,
    Marker: ({ children }: any) => children,
    GeoJSONSource: ({ children }: any) => children,
    RasterSource: ({ children }: any) => children,
    VectorSource: ({ children }: any) => children,
    Layer: (props: any) => {
      mockLayerProps.push(props);
      return null;
    },
  };
});

const layerIds = () => mockLayerProps.map((props) => String(props.id));
const hasOverlayLayer = (id: OverlayId) =>
  layerIds().some((layerId) => layerId.startsWith(`overlay-${id}`));

beforeEach(() => {
  mockLayerProps.length = 0;
});

describe('3D buildings vs. data overlays', () => {
  it('extrudes the buildings when 3D is on and no overlay is active', async () => {
    await render(<ListingMap listings={[]} buildings3D />);

    expect(layerIds()).toContain('buildings-3d');
  });

  // These overlays paint the building footprints themselves, so an extrusion of
  // those same buildings would bury the data the user turned the layer on for.
  it.each<OverlayId>(['wozValue', 'energyLabels', 'buildingAge'])(
    'draws flat under the %s overlay',
    async (id) => {
      await render(<ListingMap listings={[]} buildings3D overlay={overlayById(id)} />);

      expect(hasOverlayLayer(id)).toBe(true);
      expect(layerIds()).not.toContain('buildings-3d');
    },
  );

  // Ground-level overlays lose only the sliver under each footprint, which
  // reads as buildings standing in the data rather than as missing data.
  it.each<OverlayId>(['noise', 'airQuality', 'treeHeight', 'zoning'])(
    'keeps the extrusion under the %s overlay',
    async (id) => {
      await render(<ListingMap listings={[]} buildings3D overlay={overlayById(id)} />);

      expect(hasOverlayLayer(id)).toBe(true);
      expect(layerIds()).toContain('buildings-3d');
    },
  );

  it('brings the extrusion back once the overlay is cleared', async () => {
    const { rerender } = await render(
      <ListingMap listings={[]} buildings3D overlay={overlayById('wozValue')} />,
    );
    expect(layerIds()).not.toContain('buildings-3d');

    mockLayerProps.length = 0;
    await rerender(<ListingMap listings={[]} buildings3D overlay={null} />);

    expect(layerIds()).toContain('buildings-3d');
  });

  it('never extrudes while 3D is off, overlay or not', async () => {
    await render(<ListingMap listings={[]} overlay={overlayById('noise')} />);

    expect(layerIds()).not.toContain('buildings-3d');
  });
});
