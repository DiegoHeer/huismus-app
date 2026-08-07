import type { ReactElement } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * Hand-drawn glyphs that render identically on iOS, Android and web without an
 * icon-font dependency.
 */

/** The signature every glyph below shares, for callers that pass one around. */
export type Icon = (props: { color: string; size?: number }) => ReactElement;

/**
 * A heart glyph used for the "save"/favorite affordance. `filled` toggles the
 * saved state: outlined when unsaved, painted solid in `color` when saved.
 */
export function HeartIcon({
  filled,
  color,
  size = 20,
}: {
  filled: boolean;
  color: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * A share glyph: an upward arrow rising out of an open-topped tray, mirroring
 * the platform "share" affordance.
 */
export function ShareIcon({ color }: { color: string }) {
  const WIDTH = 16;
  const HEIGHT = 18;
  return (
    <View style={{ width: WIDTH, height: HEIGHT }}>
      {/* Tray (open top) */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: WIDTH,
          height: 9,
          borderWidth: 2,
          borderTopWidth: 0,
          borderColor: color,
          borderRadius: 2,
        }}
      />
      {/* Arrowhead */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: WIDTH / 2 - 4,
          width: 0,
          height: 0,
          borderLeftWidth: 4,
          borderRightWidth: 4,
          borderBottomWidth: 6,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        }}
      />
      {/* Arrow shaft */}
      <View
        style={{
          position: 'absolute',
          top: 5,
          left: WIDTH / 2 - 1,
          width: 2,
          height: 7,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/**
 * A downward chevron for dropdown/disclosure affordances. Callers rotate it
 * (e.g. 180°) to signal an expanded state.
 */
export function ChevronDownIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 9l6 6 6-6"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A checkmark glyph, used to flag the selected row in a menu. */
export function CheckIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M20 6L9 17l-5-5"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type FactIconProps = { color: string; size?: number };

/** Shared stroke attributes for the listing-fact glyphs below. */
function FactPath({ d, color }: { d: string; color: string }) {
  return (
    <Path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** A house with an arched door and attic window — the listing's building type. */
export function HomeIcon({ color, size = 24 }: FactIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <FactPath d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" color={color} />
      <FactPath d="M9.5 21v-5.5a2.5 2.5 0 0 1 5 0V21" color={color} />
      <FactPath d="M12 9h.01" color={color} />
    </Svg>
  );
}

/** Corner brackets around a diagonal measuring arrow — the living area in m². */
export function AreaIcon({ color, size = 24 }: FactIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <FactPath
        d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
        color={color}
      />
      <FactPath d="M7.5 16.5l9-9M12.5 7.5h4v4M11.5 16.5h-4v-4" color={color} />
    </Svg>
  );
}

/** A floor plan with interior walls and a doorway — the room count. */
export function RoomsIcon({ color, size = 24 }: FactIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <FactPath
        d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
        color={color}
      />
      <FactPath d="M12 3v9M3 12h3.5M9.5 12H21M16.5 12v9" color={color} />
    </Svg>
  );
}

/** A double bed with headboard and pillows — the bedroom count. */
export function BedIcon({ color, size = 24 }: FactIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <FactPath d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" color={color} />
      <FactPath d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" color={color} />
      <FactPath d="M12 4v6M2 18h20" color={color} />
    </Svg>
  );
}

/** A bathtub with a shower arm — the bathroom count. */
export function BathIcon({ color, size = 24 }: FactIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <FactPath
        d="M9 5L7.62 3.62A2.12 2.12 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"
        color={color}
      />
      <FactPath d="M10 4L8 6M2 12h20M7 19v2M17 19v2" color={color} />
    </Svg>
  );
}

/**
 * A mason's trowel, blade pointing down-left with the grip up-right — the
 * construction year/period. The grip is a capsule: two 45° flanks closed by a
 * semicircle at each end (chord 2r, hence the 2.68 arc deltas). Drawn corner to
 * corner rather than inside a 24×24 square, so a diagonal glyph still carries
 * the same visual weight as the upright fact icons beside it.
 */
export function TrowelIcon({ color, size = 24 }: FactIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <FactPath d="M4 20L8.5 10l5.5 5.5z" color={color} />
      <FactPath d="M11.25 12.75L13.8 10.2" color={color} />
      <FactPath
        d="M13.66 7.66L18.86 2.46a1.9 1.9 0 0 1 2.68 2.68L16.34 10.34a1.9 1.9 0 0 1-2.68-2.68z"
        color={color}
      />
    </Svg>
  );
}

/** A lightning bolt — the energy label. */
export function EnergyIcon({ color, size = 24 }: FactIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <FactPath d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" color={color} />
    </Svg>
  );
}

/**
 * Sentiment glyphs for the feedback form's picker. All three are outlined at the
 * same weight as the fact icons above — the picked option is marked by its pill,
 * not by filling the glyph, because a solid circle would swallow the neutral
 * face's own features.
 */
type SentimentIconProps = { color: string; size?: number };

/** A raised thumb — "this was good". */
export function ThumbsUpIcon({ color, size = 22 }: SentimentIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <FactPath
        d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"
        color={color}
      />
      <FactPath d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" color={color} />
    </Svg>
  );
}

/** A level-mouthed face — "this was neither good nor bad". */
export function NeutralFaceIcon({ color, size = 22 }: SentimentIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <FactPath d="M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z" color={color} />
      <FactPath d="M8 15h8" color={color} />
      <FactPath d="M9 9h.01M15 9h.01" color={color} />
    </Svg>
  );
}

/** An inverted thumb — "this was bad". */
export function ThumbsDownIcon({ color, size = 22 }: SentimentIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <FactPath
        d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"
        color={color}
      />
      <FactPath d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" color={color} />
    </Svg>
  );
}

/**
 * Appearance-mode glyphs (see `lib/settings-options.ts`), shown both on the
 * profile row and in the appearance picker. Stroked at weight 2 to match the
 * other settings icons rather than the lighter listing-fact glyphs above.
 */
type ModeIconProps = { color: string; size?: number };

/** Shared stroke attributes for the settings-weight glyphs below. */
function ModePath({ d, color, fill = 'none' }: { d: string; color: string; fill?: string }) {
  return (
    <Path
      d={d}
      fill={fill}
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** A desktop screen on a stand — "follow the system setting". */
export function MonitorIcon({ color, size = 22 }: ModeIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <ModePath
        d="M20 3H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1z"
        color={color}
      />
      <ModePath d="M8 21h8M12 17v4" color={color} />
    </Svg>
  );
}

/** A rayed sun — the light theme. */
export function SunIcon({ color, size = 22 }: ModeIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <ModePath d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" color={color} />
      <ModePath
        d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M19.07 4.93l-1.41 1.41M6.34 17.66l-1.41 1.41"
        color={color}
      />
    </Svg>
  );
}

/** A crescent moon — the dark theme. */
export function MoonIcon({ color, size = 22 }: ModeIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <ModePath d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" color={color} />
    </Svg>
  );
}

/**
 * A circle with one half painted — the "contrast" glyph standing for the
 * appearance setting itself, distinct from the three modes it selects between.
 */
export function ContrastIcon({ color, size = 22 }: ModeIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <ModePath d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" color={color} />
      <ModePath d="M12 4a8 8 0 0 1 0 16z" color={color} fill={color} />
    </Svg>
  );
}

/** A globe with a meridian and the equator — the app language. */
export function GlobeIcon({ color, size = 22 }: ModeIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <ModePath d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" color={color} />
      <ModePath d="M2 12h20" color={color} />
      <ModePath
        d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
        color={color}
      />
    </Svg>
  );
}
