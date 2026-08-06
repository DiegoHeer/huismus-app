import { useTranslation } from '@huismus/i18n';
import { Pressable, Switch, View } from 'react-native';
import { Text } from '@huismus/ui';

import { CheckIcon } from '@/components/icons';
import { InfoCard, SettingsContentScreen } from '@/components/settings-content';
import { useBrand } from '@/hooks/use-theme';
import { BASEMAP_FAMILIES, useMapSettings, type BasemapFamily } from '@/lib/map-settings';

/**
 * Map display settings (pushed from the profile screen): which basemap to draw,
 * and whether to extrude buildings. Both are read by the map screen via
 * `useMapSettings` — see `components/map-style.ts` and
 * `components/listing-map.tsx`/`.web.tsx`.
 */
export default function MapSettingsScreen() {
  const { t } = useTranslation();
  const brand = useBrand();
  const { buildings3D, setBuildings3D, basemap, setBasemap } = useMapSettings();

  return (
    <SettingsContentScreen>
      <InfoCard title={t('mapSettingsPage.basemapTitle')}>
        <Text className="text-sm text-ink-2">{t('mapSettingsPage.basemapDescription')}</Text>
        {/* `radiogroup` wraps the rows so each one is announced with its
            position ("2 of 3"); a bare `radio` outside a group is an invalid
            ARIA structure and screen readers read it as a lone control. */}
        <View
          testID="basemap-picker"
          accessibilityRole="radiogroup"
          accessibilityLabel={t('mapSettingsPage.basemapTitle')}
          className="overflow-hidden rounded-xl border border-border">
          {BASEMAP_FAMILIES.map((family, index) => (
            <BasemapOption
              key={family}
              family={family}
              selected={family === basemap}
              first={index === 0}
              onSelect={() => setBasemap(family)}
            />
          ))}
        </View>
      </InfoCard>

      <InfoCard>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-lg text-ink">{t('mapSettingsPage.buildings3D')}</Text>
            <Text className="text-sm text-ink-2">
              {t('mapSettingsPage.buildings3DDescription')}
            </Text>
          </View>
          <Switch
            value={buildings3D}
            onValueChange={setBuildings3D}
            trackColor={{ true: brand.accent }}
          />
        </View>
      </InfoCard>
    </SettingsContentScreen>
  );
}

/** One radio-style row: name, one-line description, and a tick when selected. */
function BasemapOption({
  family,
  selected,
  first,
  onSelect,
}: {
  family: BasemapFamily;
  selected: boolean;
  first: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const brand = useBrand();
  return (
    <Pressable
      testID={`basemap-option-${family}`}
      onPress={onSelect}
      accessibilityRole="radio"
      // `checked`, not `selected` — `selected` maps to aria-selected, which
      // role="radio" does not support, so the state goes unannounced.
      accessibilityState={{ checked: selected }}
      accessibilityLabel={t(`mapSettingsPage.basemap.${family}`)}
      className={`flex-row items-center justify-between gap-3 px-4 py-3 active:bg-surface ${
        first ? '' : 'border-t border-border'
      }`}>
      <View className="flex-1">
        <Text className={`text-base text-ink ${selected ? 'font-semibold' : ''}`}>
          {t(`mapSettingsPage.basemap.${family}`)}
        </Text>
        <Text className="text-sm text-ink-2">
          {t(`mapSettingsPage.basemapHint.${family}`)}
        </Text>
      </View>
      {selected ? <CheckIcon color={brand.accent} /> : null}
    </Pressable>
  );
}
