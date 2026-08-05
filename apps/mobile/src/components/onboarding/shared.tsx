import { type ReactNode } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useBrand, useTheme } from '@/hooks/use-theme';

/**
 * Shared building blocks for the intro tour pages: a consistent page scaffold
 * (hero badge + title + subtitle + content), the progress dots, the bottom
 * control bar buttons, and a small set of stroked SVG hero glyphs. Kept separate
 * from the flow orchestrator (`flow.tsx`) so each page stays declarative.
 */

const STROKE = { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Tinted rounded badge holding a page's hero glyph. */
export function HeroBadge({ children }: { children: ReactNode }) {
  return (
    <View className="h-24 w-24 items-center justify-center rounded-3xl bg-accent/10">
      {children}
    </View>
  );
}

/**
 * Vertically scrollable page body, sized to the pager cell by the flow. Pages
 * holding a slider pass `scrollEnabled={false}` while a thumb is being dragged —
 * on iOS this scroll view would otherwise cancel the drag (see
 * hooks/use-slider-drag-lock.ts).
 */
export function OnboardingPage({
  children,
  scrollEnabled,
  testID,
}: {
  children: ReactNode;
  scrollEnabled?: boolean;
  testID?: string;
}) {
  return (
    <ScrollView
      testID={testID}
      // flex:1 so the body fills its (fixed-height) pager cell on web, where a
      // ScrollView with no height otherwise collapses and hides its content.
      style={{ flex: 1 }}
      scrollEnabled={scrollEnabled}
      // flexGrow:1 lets a page whose content is shorter than the viewport
      // (e.g. the welcome page's flex-1 + justify-between wrapper) stretch to
      // fill it; pages with more content than the viewport still scroll as before.
      contentContainerStyle={{
        flexGrow: 1,
        padding: 24,
        paddingTop: 8,
        paddingBottom: 24,
        gap: 20,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

/** Low-key footer link row (Privacy / Terms) — light gray, deliberately unobtrusive. */
export function LegalLinksRow({
  onPrivacyPress,
  onTermsPress,
  privacyLabel,
  termsLabel,
}: {
  onPrivacyPress: () => void;
  onTermsPress: () => void;
  privacyLabel: string;
  termsLabel: string;
}) {
  return (
    <View className="flex-row items-center justify-center gap-3">
      <Pressable onPress={onPrivacyPress} accessibilityRole="link" hitSlop={8}>
        <Text className="text-xs text-ink-2">{privacyLabel}</Text>
      </Pressable>
      <Text className="text-xs text-border">·</Text>
      <Pressable onPress={onTermsPress} accessibilityRole="link" hitSlop={8}>
        <Text className="text-xs text-ink-2">{termsLabel}</Text>
      </Pressable>
    </View>
  );
}

/** Centered hero + title + subtitle shown at the top of every page. */
export function OnboardingHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <View className="items-center gap-4 pt-2">
      <HeroBadge>{icon}</HeroBadge>
      <View className="gap-2">
        <Text className="text-center text-2xl font-bold text-ink">
          {title}
        </Text>
        <Text className="text-center text-base leading-6 text-ink-2">
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

/**
 * Row of progress dots; the active page's dot is elongated and brand-blue.
 * `progress` is the pager's continuous position in page units (scroll x /
 * page width), so each dot's width and colour interpolate live mid-swipe
 * instead of snapping when a page settles.
 */
export function ProgressDots({
  count,
  progress,
  label,
}: {
  count: number;
  progress: Animated.AnimatedInterpolation<number> | Animated.Value;
  label: string;
}) {
  const inactive = useTheme().border;
  const { accent } = useBrand();
  return (
    <View className="flex-row items-center gap-2" accessibilityLabel={label}>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View
          key={i}
          style={{
            width: progress.interpolate({
              inputRange: [i - 1, i, i + 1],
              outputRange: [8, 22, 8],
              extrapolate: 'clamp',
            }),
            height: 8,
            borderRadius: 4,
            backgroundColor: progress.interpolate({
              inputRange: [i - 1, i, i + 1],
              outputRange: [inactive, accent, inactive],
              extrapolate: 'clamp',
            }),
          }}
        />
      ))}
    </View>
  );
}

/** Primary (filled blue) call-to-action used by the bottom control bar. */
export function PrimaryButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      className="items-center justify-center rounded-xl bg-accent px-7 py-3.5 active:opacity-80">
      <Text className="text-base font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

/** Low-emphasis text button (Back / Skip tour). */
export function TextButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={8}
      className="px-2 py-2 active:opacity-60">
      <Text className="text-base font-medium text-ink-2">{label}</Text>
    </Pressable>
  );
}

// --- Hero glyphs -------------------------------------------------------------
// Feather/Lucide-style stroked SVGs, tinted with the brand accent, mirroring
// the icon approach used elsewhere (profile.tsx, filter-pills.tsx).

function HeroSvg({ size = 44, children }: { size?: number; children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

/** Hero-glyph stroke: the brand accent for the active theme. */
function useHeroTint() {
  return useBrand().accent;
}

/** House — the welcome page. */
export function HomeGlyph({ size }: { size?: number }) {
  const HERO = useHeroTint();
  return (
    <HeroSvg size={size}>
      <Path d="M3 10.5 12 3l9 7.5" stroke={HERO} {...STROKE} />
      <Path d="M5 9.5V21h14V9.5" stroke={HERO} {...STROKE} />
      <Path d="M9.5 21v-6h5v6" stroke={HERO} {...STROKE} />
    </HeroSvg>
  );
}

/** Map pin on a folded map — the "map & insights" feature. */
export function MapPinGlyph({ size }: { size?: number }) {
  const HERO = useHeroTint();
  return (
    <HeroSvg size={size}>
      <Path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11z" stroke={HERO} {...STROKE} />
      <Circle cx={12} cy={10} r={2.5} stroke={HERO} {...STROKE} />
    </HeroSvg>
  );
}

/** Slider controls — the "powerful filters" feature. */
export function SlidersGlyph({ size }: { size?: number }) {
  const HERO = useHeroTint();
  return (
    <HeroSvg size={size}>
      <Path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4" stroke={HERO} {...STROKE} />
      <Circle cx={16} cy={6} r={2} stroke={HERO} {...STROKE} />
      <Circle cx={8} cy={12} r={2} stroke={HERO} {...STROKE} />
      <Circle cx={14} cy={18} r={2} stroke={HERO} {...STROKE} />
    </HeroSvg>
  );
}

/** Skyline of buildings — the city picker. */
export function BuildingsGlyph({ size }: { size?: number }) {
  const HERO = useHeroTint();
  return (
    <HeroSvg size={size}>
      <Rect x={3} y={9} width={7} height={12} rx={1} stroke={HERO} {...STROKE} />
      <Rect x={12} y={4} width={9} height={17} rx={1} stroke={HERO} {...STROKE} />
      <Path d="M15.5 8h2M15.5 12h2M15.5 16h2M6 13h1.5M6 17h1.5" stroke={HERO} {...STROKE} />
    </HeroSvg>
  );
}

/** Person with a plus — the create-account page. */
export function AccountGlyph({ size }: { size?: number }) {
  const HERO = useHeroTint();
  return (
    <HeroSvg size={size}>
      <Circle cx={10} cy={8} r={3.5} stroke={HERO} {...STROKE} />
      <Path d="M4 20c0-3.3 2.7-6 6-6 1.5 0 2.9.55 4 1.46" stroke={HERO} {...STROKE} />
      <Path d="M18 14v6M15 17h6" stroke={HERO} {...STROKE} />
    </HeroSvg>
  );
}
