import { useTranslation } from '@huismus/i18n';
import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { DisplayText, Text } from '@huismus/ui';

import { RangeSlider } from '@/components/range-slider';
import { useTheme } from '@/hooks/use-theme';
import {
  boundedRangeLabel,
  compactEuro,
  nearestPriceIndex,
  PRICE_DISTRIBUTION_BUY,
  PRICE_DISTRIBUTION_RENT,
  priceSteps,
  type ListingMode,
} from '@/lib/filters';

/** A titled card grouping one filter control, with an optional value summary. */
export function FilterSection({
  title,
  value,
  children,
}: {
  title: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-3 rounded-2xl bg-card p-4 shadow-sm">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-ink">{title}</Text>
        {value ? (
          <Text className="text-sm font-medium text-accent-text">{value}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export interface PillOption {
  key: string;
  label: string;
}

/**
 * A wrapping row of selectable pills. Presentational only: it reflects
 * `selected` and fires `onToggle(key)` — the parent decides single vs. multi.
 * Colours are inline (theme-driven) so they never depend on an uncompiled
 * NativeWind class.
 */
export function SelectPills({
  options,
  selected,
  onToggle,
  stretch = false,
  disabledKeys,
}: {
  options: PillOption[];
  selected: string[];
  onToggle: (key: string) => void;
  /** Stretch pills to share the row equally (full-width segmented look). */
  stretch?: boolean;
  /** Keys rendered dimmed and non-interactive (e.g. a not-yet-built option). */
  disabledKeys?: string[];
}) {
  const theme = useTheme();
  const borderColor = theme.border;
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.key);
        const disabled = disabledKeys?.includes(opt.key) ?? false;
        // Active pills invert: ink fill with ground-coloured content.
        const bg = active ? theme.text : theme.card;
        const fg = active ? theme.background : theme.text;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            // A no-op press instead of `disabled`: a disabled Pressable gives
            // the touch up entirely, letting it fall through to whatever sits
            // behind the pill (e.g. the onboarding pager's tap-to-navigate
            // zones). Swallow it here so tapping a dimmed pill does nothing.
            onPress={() => {
              if (!disabled) onToggle(opt.key);
            }}
            style={{
              backgroundColor: bg,
              borderColor: active ? bg : borderColor,
              borderWidth: 1,
              opacity: disabled ? 0.4 : undefined,
              flexGrow: stretch ? 1 : 0,
              flexBasis: stretch ? 0 : 'auto',
              alignItems: stretch ? 'center' : undefined,
            }}
            className={disabled ? 'rounded-full px-4 py-2' : 'rounded-full px-4 py-2 active:opacity-80'}>
            <Text style={{ color: fg }} className="text-base font-medium">
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A −/+ stepper. `formatValue` renders the current value (e.g. 0 → "Any").
 * With `buttonsOnly`, renders just the two buttons (no value text) — e.g. to sit
 * beside a slider whose value is shown in the section header instead.
 */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  formatValue,
  buttonsOnly = false,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (value: number) => string;
  buttonsOnly?: boolean;
}) {
  const theme = useTheme();
  const fg = theme.text;
  const disabledFg = theme.border;
  const borderColor = theme.border;
  const canDec = value > min;
  const canInc = value < max;
  const buttons = (
    <View className="flex-row items-center gap-3">
      <StepButton
        label="−"
        color={canDec ? fg : disabledFg}
        borderColor={borderColor}
        onPress={() => canDec && onChange(value - step)}
      />
      <StepButton
        label="+"
        color={canInc ? fg : disabledFg}
        borderColor={borderColor}
        onPress={() => canInc && onChange(value + step)}
      />
    </View>
  );
  if (buttonsOnly) return buttons;
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-base text-ink-2">
        {formatValue ? formatValue(value) : String(value)}
      </Text>
      {buttons}
    </View>
  );
}

// --- Composite fields ------------------------------------------------------
// Unlike the presentational controls above, these two know about the filter
// domain. Both the Filters screen and the onboarding tour show the same
// buy/rent + price pair, so the plumbing lives here once rather than being
// mirrored (and drifting) in two screens.

/**
 * Buy/Rent segmented control plus its caption. Rent is a placeholder until the
 * backend supports `deal_type=rent` — it stays visible but disabled, so Buy is
 * the only selectable option.
 *
 * Buy and rent prices live on entirely different scales (see {@link priceSteps}),
 * so a staged price range does not survive a mode change: callers own that state
 * and must clear it in `onChange`.
 */
export function ModePills({
  mode,
  onChange,
}: {
  mode: ListingMode;
  onChange: (mode: ListingMode) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <SelectPills
        stretch
        // Rent is a placeholder until the backend supports it (deal_type=rent);
        // keep it visible but disabled so Buy stays the only, selected option.
        disabledKeys={['rent']}
        options={[
          { key: 'buy', label: t('filtersPage.buy') },
          { key: 'rent', label: t('filtersPage.rent') },
        ]}
        selected={[mode]}
        // Re-picking the active mode isn't a change. Callers clear the staged
        // price range in `onChange`, so forwarding it would wipe a range the
        // user never asked to lose.
        onToggle={(key) => {
          if (key !== mode) onChange(key as ListingMode);
        }}
      />
      <Text className="text-center text-sm text-ink-2">
        {t('filtersPage.rentComingSoon')}
      </Text>
    </View>
  );
}

/** A price range in euros; `null` on either side means that end is unconstrained. */
export type PriceRange = [number | null, number | null];

/**
 * The price range card: titled section, summary, histogram and two thumbs.
 *
 * The slider underneath runs on *indices* of a log-ish ladder of stops — fine
 * near the bottom, coarse at the top, one ladder (and histogram) per mode — so
 * equal thumb travel covers €200k–€400k as comfortably as €2M–€3M. That index
 * ↔ euro adaptation is entirely internal: `value` and `onChange` both speak
 * {@link PriceRange}, where either end stop reads back as `null`.
 *
 * Pass `onDragStart`/`onDragEnd` (see `useSliderDragLock`) — without them the
 * enclosing scrollable steals the drag on iOS.
 */
export function PriceRangeField({
  mode,
  value,
  onChange,
  onDragStart,
  onDragEnd,
}: {
  mode: ListingMode;
  value: PriceRange;
  onChange: (value: PriceRange) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const { t } = useTranslation();
  const [lo, hi] = value;
  const steps = priceSteps(mode);
  const topIndex = steps.length - 1;
  const indices = [
    lo === null ? 0 : nearestPriceIndex(steps, lo),
    hi === null ? topIndex : nearestPriceIndex(steps, hi),
  ];
  // Summarise from the same indices the slider runs on, and treat the end stops
  // as open exactly as `onChange` below does. Reading the raw values instead
  // would disagree with the thumbs for a stored bound that snaps onto an end —
  // printing a "€0" floor for a thumb that is in fact unconstrained.
  const label = boundedRangeLabel(
    indices[0] <= 0 ? null : steps[indices[0]],
    indices[1] >= topIndex ? null : steps[indices[1]],
    compactEuro,
    t('filtersPage.any'),
  );
  return (
    <FilterSection title={t('filtersPage.price')} value={label}>
      <RangeSlider
        min={0}
        max={topIndex}
        step={1}
        values={indices}
        distribution={mode === 'rent' ? PRICE_DISTRIBUTION_RENT : PRICE_DISTRIBUTION_BUY}
        onChange={([nextLo, nextHi]) =>
          onChange([nextLo <= 0 ? null : steps[nextLo], nextHi >= topIndex ? null : steps[nextHi]])
        }
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />
    </FilterSection>
  );
}

function StepButton({
  label,
  color,
  borderColor,
  onPress,
}: {
  label: string;
  color: string;
  borderColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={6}
      style={{ borderColor }}
      className="h-9 w-9 items-center justify-center rounded-full border active:opacity-60">
      <DisplayText style={{ color, lineHeight: 24 }} className="text-2xl">
        {label}
      </DisplayText>
    </Pressable>
  );
}
