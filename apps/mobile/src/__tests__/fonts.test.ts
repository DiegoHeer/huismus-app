import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The bundled TTFs are embedded in the app binary by the expo-font config
 * plugin, so their size is install size and their `name` records are what iOS
 * uses to resolve `fontFamily: 'Inter'` at a given weight.
 *
 * Inter shipped here at full Unicode coverage — 2871 glyphs, ~318KB a weight,
 * 1.27MB across the four — while the web build served a 48KB Latin subset of
 * the same family. `scripts/subset-fonts.py` closed that gap; this keeps it
 * closed, and catches a font upgrade that drops the subset step or breaks the
 * naming that ties the four weights into one family.
 */

const FONT_DIR = join(__dirname, '..', '..', 'assets', 'fonts');

const WEIGHTS = ['Regular', 'Medium', 'SemiBold', 'Bold'] as const;

/** Comfortably above the ~59KB the Latin subset produces, far below the 318KB original. */
const MAX_TTF_BYTES = 100 * 1024;

/** Minimal big-endian reader for the bits of the TTF `name` table we care about. */
function nameRecords(buf: Buffer): Map<number, string> {
  const numTables = buf.readUInt16BE(4);
  let nameOffset = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString('ascii', rec, rec + 4) === 'name') {
      nameOffset = buf.readUInt32BE(rec + 8);
      break;
    }
  }
  if (nameOffset < 0) throw new Error('no name table');

  const count = buf.readUInt16BE(nameOffset + 2);
  const stringOffset = nameOffset + buf.readUInt16BE(nameOffset + 4);
  const out = new Map<number, string>();
  for (let i = 0; i < count; i++) {
    const rec = nameOffset + 6 + i * 12;
    const platformId = buf.readUInt16BE(rec);
    const nameId = buf.readUInt16BE(rec + 6);
    const length = buf.readUInt16BE(rec + 8);
    const offset = buf.readUInt16BE(rec + 10);
    // Platform 3 (Windows) records are UTF-16BE; that encoding is present for
    // every name in these files, so one decode path is enough.
    if (platformId !== 3 || out.has(nameId)) continue;
    out.set(nameId, buf.toString('utf16le', stringOffset + offset, stringOffset + offset + length)
      .split('')
      .map((c) => String.fromCharCode(((c.charCodeAt(0) & 0xff) << 8) | (c.charCodeAt(0) >> 8)))
      .join(''));
  }
  return out;
}

describe('bundled fonts', () => {
  it.each(WEIGHTS)('Inter-%s is subset, not the full face', (weight) => {
    const bytes = statSync(join(FONT_DIR, `Inter-${weight}.ttf`)).size;
    expect(bytes).toBeLessThan(MAX_TTF_BYTES);
  });

  it('keeps the whole embedded payload under a quarter of what it was', () => {
    const total = [...WEIGHTS.map((w) => `Inter-${w}.ttf`), ...WEIGHTS.map((w) => `SplineSans-${w}.ttf`)]
      .map((f) => statSync(join(FONT_DIR, f)).size)
      .reduce((a, b) => a + b, 0);
    // Was ~1.5MB across both families.
    expect(total).toBeLessThan(512 * 1024);
  });

  /**
   * iOS resolves a weight through the typographic family (name ID 16) when it
   * differs from the legacy family (ID 1) — which it does for Medium and
   * SemiBold, whose ID 1 is "Inter Medium" / "Inter SemiBold". Losing ID 16
   * would strand them outside the `Inter` family and `fontWeight: '500'` would
   * quietly synthesise instead.
   */
  it.each([
    ['Inter', 'Medium'],
    ['Inter', 'SemiBold'],
    ['Spline Sans', 'Medium'],
    ['Spline Sans', 'SemiBold'],
  ])('%s %s still groups under its typographic family', (family, weight) => {
    const file = `${family.replace(' ', '')}-${weight}.ttf`;
    const names = nameRecords(readFileSync(join(FONT_DIR, file)));
    expect(names.get(16)).toBe(family);
    expect(names.get(17)).toBe(weight);
  });

  it.each([
    ['Inter', 'Regular'],
    ['Inter', 'Bold'],
    ['Spline Sans', 'Regular'],
    ['Spline Sans', 'Bold'],
  ])('%s %s is named as the family itself', (family, weight) => {
    const file = `${family.replace(' ', '')}-${weight}.ttf`;
    const names = nameRecords(readFileSync(join(FONT_DIR, file)));
    expect(names.get(1)).toBe(family);
    expect(names.get(2)).toBe(weight);
  });
});
