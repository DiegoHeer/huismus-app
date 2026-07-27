import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * Hand-drawn glyphs that render identically on iOS, Android and web without an
 * icon-font dependency.
 */

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
      strokeWidth={2.5}
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

/** A calendar page with date dots — the construction year/period. */
export function CalendarIcon({ color, size = 24 }: FactIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <FactPath
        d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        color={color}
      />
      <FactPath d="M16 2v4M8 2v4M3 10h18" color={color} />
      <FactPath d="M8 14.5h.01M12 14.5h.01M16 14.5h.01M8 18h.01M12 18h.01" color={color} />
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
