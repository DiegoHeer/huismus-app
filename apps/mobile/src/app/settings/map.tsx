import { useTranslation } from '@huismus/i18n';
import { Switch, Text, View } from 'react-native';

import { InfoCard, SettingsContentScreen } from '@/components/settings-content';
import { useBrand } from '@/hooks/use-theme';
import { useMapSettings } from '@/lib/map-settings';

/**
 * Map display settings (pushed from the profile screen). Currently a single
 * toggle for 3D building extrusion, read by the map screen via
 * `useMapSettings` — see `components/listing-map.tsx`/`.web.tsx`.
 */
export default function MapSettingsScreen() {
  const { t } = useTranslation();
  const brand = useBrand();
  const { buildings3D, setBuildings3D } = useMapSettings();

  return (
    <SettingsContentScreen>
      <InfoCard>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-lg text-ink">
              {t('mapSettingsPage.buildings3D')}
            </Text>
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
