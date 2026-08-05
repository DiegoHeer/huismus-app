import { useTranslation } from '@huismus/i18n';
import { Text, View } from 'react-native';

import { SettingsContentScreen } from '@/components/settings-content';

// FAQ entries, keyed by id; each maps to `helpPage.faq.<id>.q` / `.a` in the
// locale files. Add an id here and the matching keys to render another item.
const FAQ_IDS = ['search', 'stats', 'foundation', 'preferences', 'realtor'] as const;

/**
 * Help & support page (pushed from the profile screen): a simple FAQ followed by
 * a note that more support features are on the way.
 */
export default function HelpSettingsScreen() {
  const { t } = useTranslation();

  return (
    <SettingsContentScreen>
      <Text className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-2">
        {t('helpPage.faqTitle')}
      </Text>

      <View className="rounded-2xl bg-card px-4 shadow-sm">
        {FAQ_IDS.map((id, index) => (
          <View
            key={id}
            className={`py-4 ${
              index > 0 ? 'border-t border-border' : ''
            }`}>
            <Text className="mb-1.5 text-base font-semibold text-ink">
              {t(`helpPage.faq.${id}.q`)}
            </Text>
            <Text className="text-base leading-6 text-ink-2">
              {t(`helpPage.faq.${id}.a`)}
            </Text>
          </View>
        ))}
      </View>

      <Text className="px-1 text-sm text-ink-2">{t('helpPage.comingSoon')}</Text>
    </SettingsContentScreen>
  );
}
