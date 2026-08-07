import type { AreaPolygon } from '@huismus/types';

import { buildAreaIndex, findAreaAt } from '@/lib/area-hit-test';

/** An axis-aligned box neighborhood, so expected containment is obvious. */
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

// Two neighborhoods sharing the border at lng 4.1 — the tessellation that makes
// the native `features[0]` hit test ambiguous.
const WEST = box('BU0001', 4.0, 52.0, 4.1, 52.1);
const EAST = box('BU0002', 4.1, 52.0, 4.2, 52.1);

describe('findAreaAt', () => {
  const index = buildAreaIndex([WEST, EAST]);

  it('picks the neighborhood containing the point', () => {
    expect(findAreaAt([4.05, 52.05], index)).toBe('BU0001');
    expect(findAreaAt([4.15, 52.05], index)).toBe('BU0002');
  });

  it('picks the correct side just inside a shared border', () => {
    // Both are within a native 44 pt hitbox of this point when zoomed out; only
    // one actually contains it.
    expect(findAreaAt([4.0999, 52.05], index)).toBe('BU0001');
    expect(findAreaAt([4.1001, 52.05], index)).toBe('BU0002');
  });

  it('is independent of the order shapes are indexed in', () => {
    const reversed = buildAreaIndex([EAST, WEST]);
    expect(findAreaAt([4.0999, 52.05], reversed)).toBe('BU0001');
    expect(findAreaAt([4.1001, 52.05], reversed)).toBe('BU0002');
  });

  it('returns null outside every neighborhood', () => {
    expect(findAreaAt([5.0, 53.0], index)).toBeNull();
    // Just beyond the western edge — a native press would still report WEST as a
    // hitbox match, but this is a press on the bare map.
    expect(findAreaAt([3.999, 52.05], index)).toBeNull();
  });

  it('returns null for an empty index', () => {
    expect(findAreaAt([4.05, 52.05], buildAreaIndex([]))).toBeNull();
  });

  it('handles MultiPolygon neighborhoods', () => {
    const split: AreaPolygon = {
      id: 'BU0003',
      color: '#00ff00',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [6.0, 54.0],
              [6.1, 54.0],
              [6.1, 54.1],
              [6.0, 54.1],
              [6.0, 54.0],
            ],
          ],
          [
            [
              [7.0, 55.0],
              [7.1, 55.0],
              [7.1, 55.1],
              [7.0, 55.1],
              [7.0, 55.0],
            ],
          ],
        ],
      },
    };
    const multiIndex = buildAreaIndex([split]);
    expect(findAreaAt([6.05, 54.05], multiIndex)).toBe('BU0003');
    expect(findAreaAt([7.05, 55.05], multiIndex)).toBe('BU0003');
    // Between the two parts: inside the bounding box, outside both rings.
    expect(findAreaAt([6.5, 54.5], multiIndex)).toBeNull();
  });

  it('excludes a point inside a hole', () => {
    const donut: AreaPolygon = {
      id: 'BU0004',
      color: '#0000ff',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
          [
            [4, 4],
            [6, 4],
            [6, 6],
            [4, 6],
            [4, 4],
          ],
        ],
      },
    };
    const holeIndex = buildAreaIndex([donut]);
    expect(findAreaAt([1, 1], holeIndex)).toBe('BU0004');
    expect(findAreaAt([5, 5], holeIndex)).toBeNull();
  });
});

describe('buildAreaIndex', () => {
  it('precomputes a bounding box per neighborhood', () => {
    expect(buildAreaIndex([WEST])).toEqual([
      { id: 'BU0001', bbox: [4.0, 52.0, 4.1, 52.1], geometry: WEST.geometry },
    ]);
  });
});
