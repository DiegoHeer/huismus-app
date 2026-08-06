import { useTranslation } from '@huismus/i18n';
import { View } from 'react-native';
import { Text } from '@huismus/ui';

import { InfoCard, Paragraph, SettingsContentScreen } from '@/components/settings-content';

// Section ids, each mapping to `privacyPolicyPage.sections.<id>.title` / `.body`
// in the locale files. Add an id here and the matching keys to add a section.
const SECTION_IDS = [
  'shortVersion',
  'accountData',
  'deviceOnlyData',
  'analytics',
  'feedbackData',
  'listingData',
  'neighborhoodStats',
  'purposes',
  'cookies',
  'sharing',
  'transfers',
  'retention',
  'rights',
  'children',
  'security',
  'changes',
  'contact',
] as const;

/**
 * Full Privacy Policy (pushed from the "Privacy & security" settings page). Unlike
 * that page's short marketing-style summary, this is the complete legal document.
 */
export default function PrivacyPolicyScreen() {
  const { t } = useTranslation();

  return (
    <SettingsContentScreen>
      <View className="gap-1 px-1">
        <Text className="text-sm text-ink-2">{t('privacyPolicyPage.lastUpdated')}</Text>
        <Text className="text-sm text-ink-2">{t('privacyPolicyPage.controller')}</Text>
      </View>

      <InfoCard>
        <Paragraph>{t('privacyPolicyPage.intro')}</Paragraph>
      </InfoCard>

      {SECTION_IDS.map((id) => (
        <InfoCard key={id} title={t(`privacyPolicyPage.sections.${id}.title`)}>
          <Paragraph>{t(`privacyPolicyPage.sections.${id}.body`)}</Paragraph>
        </InfoCard>
      ))}
    </SettingsContentScreen>
  );
}
