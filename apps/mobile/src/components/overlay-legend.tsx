import { useTranslation } from '@huismus/i18n';
import { ScrollView, View } from 'react-native';
import { MaxFontScale, Text } from '@huismus/ui';

import type { MapOverlay } from '@/lib/map-overlays';

/**
 * Height of the strip: about half a filter pill, so the legend reads as a
 * caption under the pills rather than a second row of controls.
 *
 * Pinned rather than content-sized, because a horizontal ScrollView has no
 * intrinsic height — left alone it grows into whatever vertical space the
 * absolutely-positioned header column has spare, and the content container's
 * `alignItems: 'center'` then floats the swatches in the middle of a card
 * several times this tall.
 */
const STRIP_HEIGHT = 20;

/**
 * Compact legend for the active map overlay: a horizontally scrollable strip of
 * color swatches with their value ranges/classes, shown in a rounded card under
 * the pills. The colors mirror what the backing service paints (verified
 * against its legend), so the strip explains the map rather than approximating
 * it. Building-level overlays (energy labels, bouwjaar) render nothing when the
 * camera is too far out — then the strip shows a "zoom in" hint instead.
 *
 * The text is capped at {@link MaxFontScale.fixed}: {@link STRIP_HEIGHT} can't
 * reflow, so an uncapped OS text size would be clipped by it.
 */
export function OverlayLegend({ overlay, zoom }: { overlay: MapOverlay; zoom: number }) {
  const { t } = useTranslation();
  const belowZoomFloor = overlay.visibleFromZoom != null && zoom < overlay.visibleFromZoom;
  return (
    <View
      className="mt-2 self-center justify-center overflow-hidden rounded-full bg-card shadow-md shadow-black/20"
      style={{ height: STRIP_HEIGHT }}>
      {belowZoomFloor ? (
        <Text
          className="px-3 text-[11px] font-medium text-ink-2"
          maxFontSizeMultiplier={MaxFontScale.fixed}>
          {t('layers.zoomHint')}
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Wrap the content instead of filling the parent — see STRIP_HEIGHT.
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 10, alignItems: 'center' }}>
          {overlay.legend.map((entry) => (
            <View key={entry.label} className="flex-row items-center gap-1">
              <View
                className="h-2.5 w-2.5 rounded-[3px] border border-ink/20"
                style={{ backgroundColor: entry.color }}
              />
              <Text
                className="text-[11px] font-medium text-ink"
                maxFontSizeMultiplier={MaxFontScale.fixed}>
                {entry.i18n ? t(`layers.legend.${entry.label}`) : entry.label}
              </Text>
            </View>
          ))}
          {overlay.unit && (
            <Text
              className="text-[11px] font-medium text-ink-2"
              maxFontSizeMultiplier={MaxFontScale.fixed}>
              {overlay.unit}
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}
