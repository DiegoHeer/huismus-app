#!/usr/bin/env python3
"""
Subset the bundled Inter TTFs to the Latin ranges the app actually renders.

Inter ships full Unicode coverage — 2871 glyphs, ~320KB per weight, 1.28MB
across the four we embed — while the app ships three locales (en, nl, pt) whose
alphabets all sit inside Latin. The web build already serves a 48KB latin subset
of the same family (public/fonts/inter-latin.woff2); this brings the native side
into line without giving up the four static files, which are what let `fontWeight`
select a real weight instead of synthesising one.

Spline Sans is left alone: it is display-only and already ships 481 glyphs at
52KB per weight, so there is nothing worth reclaiming.

The range is Google Fonts' own `latin`, matching what the web build already
serves. That is the point: the two halves of the app should resolve the same
glyphs, and shipping a wider subset natively would mean a name that renders in
Inter on Android quietly falls back to the system face on web.

`latin` covers en, nl and pt outright — every diacritic those three need sits in
Latin-1 Supplement. Adding `latin-ext` on top (Central/Eastern European,
Vietnamese, phonetics) costs ~70KB per weight, ~280KB across the four, and buys
robustness only for names in *live listing data* outside Latin-1 — a broker
called Şahin or Łukasz. A codepoint outside the subset still renders through the
platform's font fallback, so the cost of a miss is one glyph in the system face
mid-word, not tofu and not a crash. If that trade ever looks wrong, add
`latin-ext` here and to huismus-web's `@font-face` together, not just here.

Usage (from apps/mobile):
    python3 scripts/subset-fonts.py            # rewrites assets/fonts/Inter-*.ttf
    python3 scripts/subset-fonts.py --check     # report only, touch nothing

Requires fonttools (`pip install fonttools`). Re-run when upgrading Inter.
"""

from __future__ import annotations

import argparse
import io
import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

FONT_DIR = pathlib.Path(__file__).resolve().parent.parent / "assets" / "fonts"
TARGETS = ["Inter-Regular.ttf", "Inter-Medium.ttf", "Inter-SemiBold.ttf", "Inter-Bold.ttf"]

# Google Fonts `latin`.
LATIN = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,"
    "U+2212,U+2215,U+FEFF,U+FFFD"
)
UNICODES = LATIN

# Glyphs the UI composes directly rather than typing, so they must survive even
# if a future range change drops their block: the chevron on settings rows, the
# dismiss affordance on the map preview card, the euro on every price.
REQUIRED = "›×€—…"


def subset_font(path: pathlib.Path, write: bool) -> tuple[int, int]:
    before = path.stat().st_size

    options = subset.Options()
    # Keep every name record: iOS registers an embedded font by the family and
    # style in its `name` table, so losing them would leave `fontFamily: 'Inter'`
    # resolving to nothing. Android reads the family from app.json instead, but
    # both platforms load the same file.
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    # Kerning, contextual alternates and Inter's tabular figures all live in
    # GPOS/GSUB; dropping them would visibly loosen the type.
    options.layout_features = ["*"]
    # Android's rasteriser leans on the hinting at UI sizes.
    options.hinting = True
    options.notdef_outline = True
    options.recalc_bounds = True
    options.drop_tables = []
    # STAT carries the weight axis metadata that ties the four files together.
    options.passthrough_tables = True

    font = TTFont(path)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=subset.parse_unicodes(UNICODES), text=REQUIRED)
    subsetter.subset(font)

    buf = io.BytesIO()
    font.save(buf)
    after = len(buf.getvalue())

    if write:
        path.write_bytes(buf.getvalue())
    font.close()
    return before, after


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="report only")
    args = parser.parse_args()

    total_before = total_after = 0
    for name in TARGETS:
        path = FONT_DIR / name
        if not path.exists():
            print(f"missing: {path}", file=sys.stderr)
            return 1
        before, after = subset_font(path, write=not args.check)
        total_before += before
        total_after += after
        print(f"{name:24} {before / 1024:7.1f}K -> {after / 1024:6.1f}K")

    saved = total_before - total_after
    print(
        f"{'total':24} {total_before / 1024:7.1f}K -> {total_after / 1024:6.1f}K"
        f"  ({saved / 1024:.0f}K saved, {saved / total_before:.0%})"
    )
    if args.check:
        print("\n--check: nothing written")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
