import { useTranslation } from '@huismus/i18n';
import { Pressable, Switch, View } from 'react-native';
import { Text } from '@huismus/ui';
import Svg, { Path } from 'react-native-svg';

import { InfoCard, Paragraph, SettingsContentScreen } from '@/components/settings-content';
import { useBrand, useTheme } from '@/hooks/use-theme';
import { useAnalyticsOptOut } from '@/lib/analytics';
import { openLegalDocument } from '@/lib/legal-links';

/** Document/paper icon for the full-legal-text links below — mirrors profile.tsx's icon style. */
function PaperIcon({ color }: { color: string }) {
  const stroke = { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke={color}
        {...stroke}
      />
      <Path d="M14 2v6h6" stroke={color} {...stroke} />
      <Path d="M16 13H8" stroke={color} {...stroke} />
      <Path d="M16 17H8" stroke={color} {...stroke} />
    </Svg>
  );
}

/**
 * Privacy & security page (pushed from the profile screen). Static copy that
 * spells out the zero-data stance: no user data collected, only anonymous
 * in-app usage measured, and search/preferences never collected or resold.
 * The last card lets the user opt out of that anonymous usage measurement, and
 * links out to the full legal documents on the website.
 */
export default function PrivacySettingsScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const brand = useBrand();
  const { optedOut, setOptedOut } = useAnalyticsOptOut();
  const iconColor = theme.text;

  return (
    <SettingsContentScreen>
      <InfoCard title={t('privacyPage.zeroDataTitle')}>
        <Paragraph>{t('privacyPage.zeroDataBody')}</Paragraph>
      </InfoCard>
      <InfoCard title={t('privacyPage.behaviorTitle')}>
        <Paragraph>{t('privacyPage.behaviorBody')}</Paragraph>
      </InfoCard>
      <InfoCard title={t('privacyPage.noResaleTitle')}>
        <Paragraph>{t('privacyPage.noResaleBody')}</Paragraph>
      </InfoCard>
      <InfoCard title={t('privacyPage.optOutTitle')}>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-lg text-ink">
              {t('privacyPage.optOutLabel')}
            </Text>
            <Text className="text-sm text-ink-2">
              {t('privacyPage.optOutDescription')}
            </Text>
          </View>
          <Switch
            value={!optedOut}
            onValueChange={(enabled) => setOptedOut(!enabled)}
            trackColor={{ true: brand.accent }}
          />
        </View>
      </InfoCard>

      <InfoCard>
        <Pressable
          onPress={() => openLegalDocument('privacy-policy', i18n.language)}
          accessibilityRole="link"
          className="flex-row items-center justify-between active:opacity-60">
          <View className="flex-row items-center gap-3">
            <PaperIcon color={iconColor} />
            <Text className="text-lg text-ink">
              {t('legal.privacyPolicy')}
            </Text>
          </View>
          <Text className="text-xl text-ink-2">›</Text>
        </Pressable>
        <Pressable
          onPress={() => openLegalDocument('terms-of-use', i18n.language)}
          accessibilityRole="link"
          className="flex-row items-center justify-between border-t border-border pt-3 active:opacity-60">
          <View className="flex-row items-center gap-3">
            <PaperIcon color={iconColor} />
            <Text className="text-lg text-ink">
              {t('legal.termsOfUse')}
            </Text>
          </View>
          <Text className="text-xl text-ink-2">›</Text>
        </Pressable>
      </InfoCard>
    </SettingsContentScreen>
  );
}
