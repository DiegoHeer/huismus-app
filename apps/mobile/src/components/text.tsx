import { forwardRef } from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

import { Fonts } from '@/constants/theme';

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
 * Import these instead of react-native's in app code. Refs are forwarded, so a
 * `useRef<RNTextInput>` still focuses the real input (see location-search.tsx).
 */
const bodyFont = { fontFamily: Fonts.body } as const;
const displayFont = { fontFamily: Fonts.display } as const;

export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...rest }, ref) {
  return <RNText ref={ref} style={[bodyFont, style]} {...rest} />;
});

/**
 * Spline Sans — page titles and the largest headings only. The design system
 * rations display type the way it rations red; everything else is {@link Text}.
 */
export const DisplayText = forwardRef<RNText, TextProps>(function DisplayText(
  { style, ...rest },
  ref,
) {
  return <RNText ref={ref} style={[displayFont, style]} {...rest} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { style, ...rest },
  ref,
) {
  return <RNTextInput ref={ref} style={[bodyFont, style]} {...rest} />;
});
