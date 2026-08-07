import { useTranslation } from '@huismus/i18n';
import { ScrollView, View } from 'react-native';
import { Text } from '@huismus/ui';

import { hides3DBuildings, type MapOverlay } from '@/lib/map-overlays';

/**
 * Compact legend for the active map overlay: a horizontally scrollable strip of
 * color swatches with their value ranges/classes, shown in a rounded card under
 * the pills. The colors mirror what the backing service paints (verified
 * against its legend), so the strip explains the map rather than approximating
 * it. Building-level overlays (energy labels, bouwjaar) render nothing when the
 * camera is too far out — then the strip shows a "zoom in" hint instead.
 *
 * Those same overlays also switch the 3D buildings off while they're active
 * (see `hides3DBuildings`); when the user has 3D turned on, the strip says so,
 * otherwise the preference would look broken.
 */
export function OverlayLegend({
  overlay,
  zoom,
  buildings3D,
}: {
  overlay: MapOverlay;
  zoom: number;
  buildings3D?: boolean;
}) {
  const { t } = useTranslation();
  const belowZoomFloor = overlay.visibleFromZoom != null && zoom < overlay.visibleFromZoom;
  const paused3D = Boolean(buildings3D) && hides3DBuildings(overlay);
  return (
    <View className="mt-2 self-center overflow-hidden rounded-2xl bg-card shadow-md shadow-black/20">
      {belowZoomFloor ? (
        <Text className="px-4 py-2 text-xs font-medium text-ink-2">
          {t('layers.zoomHint')}
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' }}>
          {overlay.legend.map((entry) => (
            <View key={entry.label} className="flex-row items-center gap-1.5">
              <View
                className="h-3 w-3 rounded-sm border border-ink/20"
                style={{ backgroundColor: entry.color }}
              />
              <Text className="text-xs font-medium text-ink">
                {entry.i18n ? t(`layers.legend.${entry.label}`) : entry.label}
              </Text>
            </View>
          ))}
          {overlay.unit && (
            <Text className="text-xs font-medium text-ink-2">
              {overlay.unit}
            </Text>
          )}
        </ScrollView>
      )}
      {/* Only once the layer is actually painting — below the zoom floor the
          "zoom in" hint is the useful message, and 3D is off there anyway. */}
      {paused3D && !belowZoomFloor && (
        <Text className="px-3 pb-2 text-[11px] font-medium text-ink-2">
          {t('layers.flat3DHint')}
        </Text>
      )}
    </View>
  );
}
