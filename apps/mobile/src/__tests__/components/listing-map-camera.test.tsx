import { render } from '@testing-library/react-native';

import { ListingMap } from '@/components/listing-map';

// The global mock in test-setup renders Camera as null, which drops its props.
// Re-mock the module here so the camera's mount framing is inspectable.
const mockCameraProps: Record<string, unknown>[] = [];
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Map: ({ children, ...props }: any) =>
      React.createElement(View, { testID: 'maplibre-map', ...props }, children),
    Camera: (props: any) => {
      mockCameraProps.push(props);
      return null;
    },
    Marker: ({ children }: any) => children,
    GeoJSONSource: ({ children }: any) => children,
    RasterSource: ({ children }: any) => children,
    VectorSource: ({ children }: any) => children,
    Layer: () => null,
  };
});

beforeEach(() => {
  mockCameraProps.length = 0;
});

describe('ListingMap camera', () => {
  // 3D buildings extrude the basemap top-down; the tilt is the user's to set.
  it('mounts flat when 3D buildings are enabled', async () => {
    await render(<ListingMap listings={[]} buildings3D />);

    expect(mockCameraProps.length).toBeGreaterThan(0);
    for (const props of mockCameraProps) {
      const view = props.initialViewState as { pitch?: number } | undefined;
      expect(view).toBeDefined();
      expect(view?.pitch).toBeUndefined();
    }
  });

  it('frames the same way whether or not 3D buildings are enabled', async () => {
    await render(<ListingMap listings={[]} buildings3D />);
    const with3D = mockCameraProps.at(-1)?.initialViewState;

    mockCameraProps.length = 0;
    await render(<ListingMap listings={[]} buildings3D={false} />);
    const without3D = mockCameraProps.at(-1)?.initialViewState;

    expect(with3D).toBeDefined();
    expect(with3D).toEqual(without3D);
  });

  it('exposes no imperative tilt control', async () => {
    const ref = { current: null } as { current: unknown };
    await render(<ListingMap ref={ref as never} listings={[]} buildings3D />);

    expect(ref.current).toHaveProperty('flyTo');
    expect(ref.current).not.toHaveProperty('setPitch');
  });
});
