import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@huismus/ui';
import Svg, { Path } from 'react-native-svg';

import { useBrand } from '@/hooks/use-theme';


export interface SettingsOption {
  /** Stable identity, used for selection comparison and as the React key. */
  key: string;
  label: string;
}

/** Feather-style check mark, shown next to the active option. */
function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Full-screen single-select list backing the Language and Appearance settings
 * pages. Renders a grouped card of options with a check mark on the active one;
 * the parent owns what selecting does (apply the choice, then navigate back).
 */
export function SettingsOptionsScreen({
  options,
  selectedKey,
  onSelect,
}: {
  options: SettingsOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  // Matches the app's `text-accent-text` convention.
  const checkColor = useBrand().accent;

  return (
    <View className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        <View className="overflow-hidden rounded-2xl bg-card shadow-sm">
          {options.map((option, index) => {
            const selected = option.key === selectedKey;
            return (
              <Pressable
                key={option.key}
                onPress={() => onSelect(option.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`flex-row items-center justify-between px-4 py-4 active:opacity-60 ${
                  index > 0 ? 'border-t border-border' : ''
                }`}>
                <Text className="text-lg text-ink">{option.label}</Text>
                {selected ? <CheckIcon color={checkColor} /> : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
