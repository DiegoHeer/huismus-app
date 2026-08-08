import { useListingsCount } from '@huismus/data';
import { useTranslation } from '@huismus/i18n';
import type { BuildingType } from '@huismus/types';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@huismus/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  FilterSection,
  ModePills,
  PriceRangeField,
  SelectPills,
  Stepper,
} from '@/components/filter-controls';
import { RangeSlider } from '@/components/range-slider';
import { useSliderDragLock } from '@/hooks/use-slider-drag-lock';
import { deferNavigation } from '@/lib/navigation';
import { trackFiltersApplied } from '@/lib/analytics';
import { useBrand } from '@/hooks/use-theme';
import {
  AREA_DOMAIN,
  boundedRangeLabel,
  BUILDING_TYPES,
  countActiveFilters,
  DEFAULT_FILTERS,
  ENERGY_LABELS,
  filtersToQuery,
  SORT_OPTIONS,
  useFilters,
  YEAR_DOMAIN,
  type Filters,
} from '@/lib/filters';

// Debounce a rapidly-changing value (e.g. while dragging a slider) so the
// "Show N homes" count isn't refetched on every intermediate value.
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Full-screen search filters, pushed from the search bar's filters button.
 * Edits stage in a local `draft`; "Show homes" commits the draft to the shared
 * filter store and pops back, "Reset" (header) clears the draft. The store then
 * drives both the map's visible listings and the search bar's count badge.
 */
export default function FiltersScreen() {
  const brand = useBrand();
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { filters, setFilters } = useFilters();

  // Stage edits locally; nothing affects the map until "Show homes".
  const [draft, setDraft] = useState<Filters>(filters);
  const update = (patch: Partial<Filters>) => setDraft((d) => ({ ...d, ...patch }));

  // A thumb drag must not double as a screen gesture. iOS otherwise reads a
  // vertical wobble as a scroll of the list below (its scroll view cancels the
  // touch it's holding) and a left-to-right drag as the screen's back-swipe —
  // most sliders sit at their minimum, hard against the left edge. So park both
  // for the duration of the drag: `sliderDrag` is spread onto every slider,
  // `dragging` disables the ScrollView below and the pop gesture here.
  const { dragging, sliderDrag } = useSliderDragLock();
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !dragging });
  }, [navigation, dragging]);

  // Reset lives in the native header, mirroring the pushed settings screens.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => setDraft(DEFAULT_FILTERS)} hitSlop={8} accessibilityRole="button">
          <Text style={{ color: brand.text }} className="text-base font-semibold">
            {t('filtersPage.reset')}
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, t, brand.text]);

  // "Show N homes" reflects the true server-side match count for the staged
  // draft. Debounce so dragging a slider doesn't fire a request per frame; the
  // count query keeps its previous value while the next one loads. Sort doesn't
  // affect the count, so it's dropped from the count request in the data layer.
  const debouncedDraft = useDebouncedValue(draft, 300);
  const { data: matchCount } = useListingsCount(filtersToQuery(debouncedDraft));
  const anyLabel = t('filtersPage.any');

  // Bedrooms/bathrooms render as discrete 0–6 sliders; 0 reads as "Any", n as "+n".
  const roomCountLabel = (v: number) => (v === 0 ? anyLabel : `+${v}`);

  const areaValues = [draft.minAreaSqm ?? AREA_DOMAIN.min, draft.maxAreaSqm ?? AREA_DOMAIN.max];
  const areaLabel = boundedRangeLabel(draft.minAreaSqm, draft.maxAreaSqm, String, anyLabel, 'm²');

  // Energy labels are a free multi-select; summarise them in canonical (best→worst)
  // order regardless of the order they were toggled in.
  const energyLabelSummary =
    draft.energyLabels.length > 0
      ? ENERGY_LABELS.filter((l) => draft.energyLabels.includes(l)).join(', ')
      : anyLabel;

  function apply() {
    trackFiltersApplied(countActiveFilters(draft));
    setFilters(draft);
    // Defer the pop one frame: committing filters re-renders the map (which
    // draws listing imagery) and popping in the same frame races
    // react-native-screens' transition and crashes Android with "recycled
    // bitmap". Mirrors app/settings/language.tsx.
    deferNavigation(() => router.back());
  }

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        testID="filters-scroll"
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!dragging}
        showsVerticalScrollIndicator={false}>
        <ModePills
          mode={draft.mode}
          // The price ladders differ per mode, so a staged range can't carry over.
          onChange={(mode) => update({ mode, minPrice: null, maxPrice: null })}
        />

        <PriceRangeField
          mode={draft.mode}
          value={[draft.minPrice, draft.maxPrice]}
          onChange={([minPrice, maxPrice]) => update({ minPrice, maxPrice })}
          {...sliderDrag}
        />

        <FilterSection title={t('filtersPage.propertyType')}>
          <SelectPills
            options={BUILDING_TYPES.map((key) => ({
              key,
              label: t(`filtersPage.buildingTypes.${key}` as const),
            }))}
            selected={draft.propertyTypes}
            onToggle={(key) =>
              update({
                propertyTypes: draft.propertyTypes.includes(key as BuildingType)
                  ? draft.propertyTypes.filter((x) => x !== key)
                  : [...draft.propertyTypes, key as BuildingType],
              })
            }
          />
        </FilterSection>

        <FilterSection title={t('filtersPage.bedrooms')} value={roomCountLabel(draft.minBedrooms)}>
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <RangeSlider
                min={0}
                max={6}
                step={1}
                values={[draft.minBedrooms]}
                onChange={([v]) => update({ minBedrooms: v })}
                {...sliderDrag}
              />
            </View>
            <Stepper
              buttonsOnly
              value={draft.minBedrooms}
              min={0}
              max={6}
              onChange={(v) => update({ minBedrooms: v })}
            />
          </View>
        </FilterSection>

        <FilterSection title={t('filtersPage.bathrooms')} value={roomCountLabel(draft.minBathrooms)}>
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <RangeSlider
                min={0}
                max={6}
                step={1}
                values={[draft.minBathrooms]}
                onChange={([v]) => update({ minBathrooms: v })}
                {...sliderDrag}
              />
            </View>
            <Stepper
              buttonsOnly
              value={draft.minBathrooms}
              min={0}
              max={6}
              onChange={(v) => update({ minBathrooms: v })}
            />
          </View>
        </FilterSection>

        <FilterSection title={t('filtersPage.size')} value={areaLabel}>
          <RangeSlider
            min={AREA_DOMAIN.min}
            max={AREA_DOMAIN.max}
            step={AREA_DOMAIN.step}
            values={areaValues}
            onChange={([lo, hi]) =>
              update({
                minAreaSqm: lo <= AREA_DOMAIN.min ? null : lo,
                maxAreaSqm: hi >= AREA_DOMAIN.max ? null : hi,
              })
            }
            {...sliderDrag}
          />
        </FilterSection>

        <FilterSection title={t('filtersPage.energyLabel')} value={energyLabelSummary}>
          <SelectPills
            options={ENERGY_LABELS.map((label) => ({ key: label, label }))}
            selected={draft.energyLabels}
            onToggle={(key) =>
              update({
                energyLabels: draft.energyLabels.includes(key)
                  ? draft.energyLabels.filter((x) => x !== key)
                  : [...draft.energyLabels, key],
              })
            }
          />
        </FilterSection>

        <FilterSection
          title={t('filtersPage.buildYear')}
          value={draft.minBuildYear === null ? anyLabel : String(draft.minBuildYear)}>
          <RangeSlider
            min={YEAR_DOMAIN.min}
            max={YEAR_DOMAIN.max}
            step={YEAR_DOMAIN.step}
            values={[draft.minBuildYear ?? YEAR_DOMAIN.min]}
            onChange={([v]) => update({ minBuildYear: v <= YEAR_DOMAIN.min ? null : v })}
            {...sliderDrag}
          />
        </FilterSection>

        <FilterSection
          title={t('filtersPage.sort')}
          value={t(`filtersPage.sortOptions.${draft.sort}` as const)}>
          <SelectPills
            options={SORT_OPTIONS.map((key) => ({
              key,
              label: t(`filtersPage.sortOptions.${key}` as const),
            }))}
            selected={[draft.sort]}
            onToggle={(key) => update({ sort: key as Filters['sort'] })}
          />
        </FilterSection>
      </ScrollView>

      <View
        style={{ paddingBottom: insets.bottom + 12 }}
        className="border-t border-border bg-card px-4 pt-3">
        <Pressable
          onPress={apply}
          accessibilityRole="button"
          className="items-center rounded-xl bg-accent py-3.5 active:opacity-80">
          <Text className="text-base font-semibold text-white">
            {matchCount === undefined
              ? t('filtersPage.showHomesLoading')
              : t('filtersPage.showHomes', { count: matchCount })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
