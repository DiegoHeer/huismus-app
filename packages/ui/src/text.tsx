import { forwardRef } from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

import { Fonts } from './fonts';

/**
 * `Text` and `TextInput` with the app's body face applied by default.
 *
 * React Native has no global text style, and the two obvious shortcuts don't
 * work here: React 19 dropped `defaultProps` on function components, and on web
 * react-native-web writes its own `font-family` onto every Text via a generated
 * class, so a family set on an ancestor never inherits down.
 *
 * So the font is seeded per element instead. `className` is forwarded untouched
 * to the underlying RN primitive, which is where NativeWind's interop lives —
 * that keeps every `text-ink` / `font-semibold` class working exactly as before.
 *
 * The seed goes in `style` ahead of the caller's own, so any explicit style
 * still wins. A `font-*` *class* would not: NativeWind resolves className into
 * the element before the style prop, so the seed would beat it. That's why the
 * display face is its own component rather than a `font-display` class — the
 * precedence is then unambiguous on both platforms.
 *
 * This lives in `@huismus/ui` rather than in the app so that it is genuinely the
 * *only* mechanism. It used to sit in `apps/mobile/src/components/text.tsx`,
 * which left this package unable to reach it — `ListingCard` reached for a
 * `font-body` class instead, so the app had two ways to set the same family and
 * no test telling them apart. Import these instead of react-native's in every
 * package. Refs are forwarded, so a `useRef<RNTextInput>` still focuses the real
 * input (see apps/mobile location-search.tsx).
 */
const bodyFont = { fontFamily: Fonts.body } as const;
const displayFont = { fontFamily: Fonts.display } as const;

/**
 * How far the OS text-size setting is allowed to scale each role.
 *
 * `allowFontScaling` is left on — refusing to grow at all is the one genuinely
 * inaccessible choice — but unbounded is not the other option. React Native
 * applies a single linear multiplier rather than iOS's per-text-style Dynamic
 * Type ramps (it doesn't bridge `UIFontMetrics`), so the same factor that makes
 * body copy readable at AX5 takes a 30px page title past 90px and breaks the
 * layout around it. A cap per role is the substitute for the ramp.
 *
 * Pass `maxFontSizeMultiplier` explicitly to override; pass `undefined` and the
 * role default applies.
 */
export const MaxFontScale = {
  /**
   * Body copy, labels, secondary text. 2× is the 200% WCAG 1.4.4 asks for, and
   * this is the text that has to reach it.
   */
  content: 2,
  /**
   * Display type. It starts far above the readable floor, so the cap costs
   * legibility nothing — whereas letting a title grow unbounded pushes content
   * off screen, which is itself the "loss of content or functionality" 1.4.4
   * prohibits.
   */
  display: 1.5,
  /**
   * Text sealed inside fixed geometry that cannot reflow — the map pin bubble,
   * whose tail and outline are drawn to a set size. Deliberately the tightest
   * cap; anything using it should be a glyph or a few characters.
   */
  fixed: 1.2,
} as const;

export const Text = forwardRef<RNText, TextProps>(function Text(
  { style, maxFontSizeMultiplier, ...rest },
  ref,
) {
  return (
    <RNText
      ref={ref}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? MaxFontScale.content}
      style={[bodyFont, style]}
      {...rest}
    />
  );
});

/**
 * Spline Sans — page titles and the largest headings only. The design system
 * rations display type the way it rations red; everything else is {@link Text}.
 */
export const DisplayText = forwardRef<RNText, TextProps>(function DisplayText(
  { style, maxFontSizeMultiplier, ...rest },
  ref,
) {
  return (
    <RNText
      ref={ref}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? MaxFontScale.display}
      style={[displayFont, style]}
      {...rest}
    />
  );
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { style, maxFontSizeMultiplier, ...rest },
  ref,
) {
  return (
    <RNTextInput
      ref={ref}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? MaxFontScale.content}
      style={[bodyFont, style]}
      {...rest}
    />
  );
});
