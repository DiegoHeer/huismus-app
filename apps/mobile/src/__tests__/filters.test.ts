import {
  boundedRangeLabel,
  compactEuro,
  DEFAULT_FILTERS,
  filtersToQuery,
  nearestPriceIndex,
  PRICE_STEPS_BUY,
  PRICE_STEPS_RENT,
  type Filters,
} from '@/lib/filters';

describe('filtersToQuery', () => {
  it('maps the unfiltered defaults to deal_type sale + newest with no constraints', () => {
    expect(filtersToQuery(DEFAULT_FILTERS)).toEqual({
      dealType: 'sale',
      minPrice: undefined,
      maxPrice: undefined,
      buildingTypes: undefined,
      minBedrooms: undefined,
      minBathrooms: undefined,
      minAreaSqm: undefined,
      maxAreaSqm: undefined,
      energyLabels: undefined,
      minBuildYear: undefined,
      sort: 'newest',
    });
  });

  it('maps rent mode to deal_type rent', () => {
    expect(filtersToQuery({ ...DEFAULT_FILTERS, mode: 'rent' }).dealType).toBe('rent');
  });

  it('forwards set facets and drops "any" (null/empty/0) ones', () => {
    const filters: Filters = {
      ...DEFAULT_FILTERS,
      minPrice: 300000,
      maxPrice: null,
      propertyTypes: ['apartment', 'terraced'],
      minBedrooms: 2,
      minBathrooms: 0,
      minAreaSqm: 70,
      energyLabels: ['A', 'B'],
      minBuildYear: 1990,
      sort: 'price_asc',
    };
    const q = filtersToQuery(filters);
    expect(q.minPrice).toBe(300000);
    expect(q.maxPrice).toBeUndefined();
    expect(q.buildingTypes).toEqual(['apartment', 'terraced']);
    expect(q.minBedrooms).toBe(2);
    expect(q.minBathrooms).toBeUndefined();
    expect(q.minAreaSqm).toBe(70);
    expect(q.energyLabels).toEqual(['A', 'B']);
    expect(q.minBuildYear).toBe(1990);
    expect(q.sort).toBe('price_asc');
  });
});

describe('price ladders', () => {
  it('buy ladder spans 0 to 5M with fine steps low and coarse steps high', () => {
    expect(PRICE_STEPS_BUY[0]).toBe(0);
    expect(PRICE_STEPS_BUY[PRICE_STEPS_BUY.length - 1]).toBe(5_000_000);
    // Fine around 200k–400k: 25k per stop.
    expect(PRICE_STEPS_BUY).toEqual(expect.arrayContaining([200_000, 225_000, 375_000, 400_000]));
    // Coarse around 2M–3M: 250k per stop, so 2.1M is not a stop.
    expect(PRICE_STEPS_BUY).toEqual(expect.arrayContaining([2_000_000, 2_250_000, 3_000_000]));
    expect(PRICE_STEPS_BUY).not.toContain(2_100_000);
    // Strictly increasing (a sane ladder for index-based slider math).
    for (let i = 1; i < PRICE_STEPS_BUY.length; i++) {
      expect(PRICE_STEPS_BUY[i]).toBeGreaterThan(PRICE_STEPS_BUY[i - 1]);
    }
  });

  it('rent ladder spans 0 to 5000, finest through the common 800–2000 band', () => {
    expect(PRICE_STEPS_RENT[0]).toBe(0);
    expect(PRICE_STEPS_RENT[PRICE_STEPS_RENT.length - 1]).toBe(5000);
    expect(PRICE_STEPS_RENT).toEqual(expect.arrayContaining([850, 1450, 2000]));
    expect(PRICE_STEPS_RENT).not.toContain(3050);
  });

  it('nearestPriceIndex snaps arbitrary persisted prices onto the ladder', () => {
    expect(nearestPriceIndex(PRICE_STEPS_BUY, 0)).toBe(0);
    expect(PRICE_STEPS_BUY[nearestPriceIndex(PRICE_STEPS_BUY, 310_000)]).toBe(300_000);
    // Old linear domain values above still land sensibly.
    expect(PRICE_STEPS_BUY[nearestPriceIndex(PRICE_STEPS_BUY, 2_975_000)]).toBe(3_000_000);
    // Values beyond the ladder clamp to the top stop.
    expect(nearestPriceIndex(PRICE_STEPS_BUY, 9_000_000)).toBe(PRICE_STEPS_BUY.length - 1);
  });
});

describe('boundedRangeLabel', () => {
  const any = 'Any';

  it('collapses to the "any" label when neither end is constrained', () => {
    expect(boundedRangeLabel(null, null, compactEuro, any)).toBe('Any');
  });

  it('drops an open low end rather than printing it as €0', () => {
    expect(boundedRangeLabel(null, 450_000, compactEuro, any)).toBe('≤ €450k');
  });

  it('drops an open high end rather than printing the top stop with a +', () => {
    expect(boundedRangeLabel(300_000, null, compactEuro, any)).toBe('≥ €300k');
  });

  it('prints both bounds when both are constrained', () => {
    expect(boundedRangeLabel(300_000, 450_000, compactEuro, any)).toBe('€300k – €450k');
  });

  it('shares a trailing unit across the range instead of repeating it', () => {
    expect(boundedRangeLabel(null, 250, String, any, 'm²')).toBe('≤ 250 m²');
    expect(boundedRangeLabel(80, null, String, any, 'm²')).toBe('≥ 80 m²');
    expect(boundedRangeLabel(80, 250, String, any, 'm²')).toBe('80 – 250 m²');
  });

  it('never appends the unit to the "any" label', () => {
    expect(boundedRangeLabel(null, null, String, any, 'm²')).toBe('Any');
  });

  it('treats a genuine 0 bound as a constraint, not as "open"', () => {
    // Only `null` means unconstrained; a 0 that the caller chose to pass through
    // still prints, so the helper never silently swallows a real zero bound.
    expect(boundedRangeLabel(0, 450_000, compactEuro, any)).toBe('€0 – €450k');
  });
});

describe('compactEuro', () => {
  it('scales the unit to the magnitude', () => {
    expect(compactEuro(0)).toBe('€0');
    expect(compactEuro(1450)).toBe('€1450');
    expect(compactEuro(675_000)).toBe('€675k');
    expect(compactEuro(1_200_000)).toBe('€1.2M');
    expect(compactEuro(5_000_000)).toBe('€5M');
  });
});
