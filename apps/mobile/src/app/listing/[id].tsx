import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { formatPrice, relativeTimeSince, useListing } from '@huismus/data';
import { useTranslation } from '@huismus/i18n';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { type ComponentType, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { trackOutboundLink, withUtmParams } from '@/lib/analytics';
import { listingWebUrl } from '@/lib/listing-share-url';
import { toggleLike, useIsLiked } from '@/lib/likes';
import { recordRecentView } from '@/lib/recent-views';
import { Brand } from '@/constants/theme';
import {
  AreaIcon,
  BathIcon,
  BedIcon,
  CalendarIcon,
  EnergyIcon,
  HeartIcon,
  HomeIcon,
  RoomsIcon,
  ShareIcon,
} from '../../components/icons';
import { LocationMap } from '../../components/location-map';
// maptiler-basic GL style, with its key-gated MapTiler source/glyphs rewritten
// to keyless OpenFreeMap endpoints. https://github.com/openmaptiles/maptiler-basic-gl-style
import maptilerBasicStyle from '../../components/maptiler-basic-style.json';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: listing, isLoading, isError } = useListing(id);
  const { t, i18n } = useTranslation();
  const scheme = useColorScheme();
  const liked = useIsLiked(id);

  // Snapshot the listing as recently viewed once it loads. Re-runs (and so
  // refreshes the cached copy) whenever a different listing resolves.
  useEffect(() => {
    if (listing) recordRecentView(listing);
  }, [listing]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator />
      </View>
    );
  }

  if (isError || !listing) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6 dark:bg-black">
        <Text className="text-center text-neutral-600 dark:text-neutral-300">
          {t('listing.loadError')}
        </Text>
      </View>
    );
  }

  const cover = listing.images[0];

  const isDark = scheme === 'dark';
  const headerTint = isDark ? '#f5f5f5' : '#404040';

  // Native share sheet with the public web link for this listing. `url` is
  // honoured by iOS; Android only reads `message`, so the link is included in
  // both. Opening it hands off to this same screen via Universal/App Links
  // when the app is installed (see app/[locale]/listing/[slug]/[id].tsx),
  // or an SEO landing page on huismusapp.com when it isn't.
  const onShare = async () => {
    const url = listingWebUrl(listing, i18n.language);
    try {
      await Share.share({ title: listing.title, message: `${listing.title}\n${url}`, url });
    } catch {
      // Sheet dismissed or share failed — best-effort, nothing to recover.
    }
  };

  // How long the listing has been on the platform, as a localized relative phrase.
  const rel = relativeTimeSince(listing.createdAt);
  const listedAgo = rel
    ? rel.unit === 'today'
      ? t('listing.listedAgo.today')
      : t(`listing.listedAgo.${rel.unit}`, { count: rel.count })
    : null;

  const stats: (FactRow | null)[] = [
    listing.buildingType
      ? {
          label: t('listing.buildingType'),
          value: t(`listing.buildingTypes.${listing.buildingType}`),
          icon: HomeIcon,
        }
      : null,
    listing.areaSqm
      ? {
          label: t('listing.areaLabel'),
          value: t('listing.area', { value: listing.areaSqm }),
          icon: AreaIcon,
        }
      : null,
    listing.roomCount
      ? { label: t('listing.rooms'), value: `${listing.roomCount}`, icon: RoomsIcon }
      : null,
    listing.bedrooms
      ? { label: t('listing.bedrooms'), value: `${listing.bedrooms}`, icon: BedIcon }
      : null,
    listing.bathrooms
      ? { label: t('listing.bathrooms'), value: `${listing.bathrooms}`, icon: BathIcon }
      : null,
    listing.constructionPeriod
      ? {
          label: t('listing.constructionPeriod'),
          value: listing.constructionPeriod,
          icon: CalendarIcon,
        }
      : null,
    listing.energyLabel
      ? {
          label: t('listing.energyLabel'),
          value: listing.energyLabel,
          badgeColor: energyLabelColor(listing.energyLabel),
          icon: EnergyIcon,
        }
      : null,
  ];
  const facts = stats.filter((s): s is FactRow => s != null);

  return (
    <>
      <Stack.Screen
        options={{
          title: listing.address.city,
          headerRight: () => (
            <View className="flex-row items-center gap-4 pr-3">
              <Pressable
                onPress={() => toggleLike(listing)}
                accessibilityRole="button"
                accessibilityState={{ selected: liked }}
                accessibilityLabel={t(liked ? 'listing.unlike' : 'listing.like')}
                hitSlop={8}
                className="h-9 w-9 items-center justify-center active:opacity-60">
                <HeartIcon filled={liked} color={liked ? Brand.blue : headerTint} />
              </Pressable>
              <Pressable
                onPress={onShare}
                accessibilityRole="button"
                accessibilityLabel={t('listing.share')}
                hitSlop={8}
                className="h-9 w-9 pr-4 items-center justify-center active:opacity-60">
                <ShareIcon color={headerTint} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView className="flex-1 bg-white dark:bg-black">
        {cover ? (
          <Image source={{ uri: cover.url }} style={{ width: '100%', height: 288 }} contentFit="cover" />
        ) : (
          <View className="h-72 w-full bg-neutral-200 dark:bg-neutral-800" />
        )}
        <View className="gap-3 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-3xl font-bold text-neutral-900 dark:text-white">
              {formatPrice(listing.price, listing.currency, i18n.language)}
            </Text>
            <Text className="text-sm font-medium uppercase text-blue-600 dark:text-blue-400">
              {t(`listing.status.${listing.status}`)}
            </Text>
          </View>

          <Text className="text-lg text-neutral-800 dark:text-neutral-200">{listing.title}</Text>
          <Text className="text-sm text-neutral-500">
            {listing.address.line1}, {listing.address.postalCode} {listing.address.city}
          </Text>
          {listedAgo ? (
            <Text className="text-xs text-neutral-400 dark:text-neutral-500">{listedAgo}</Text>
          ) : null}

          {facts.length ? <FactsTable facts={facts} isDark={isDark} /> : null}


          {listing.foundationRisk ? (
            <View className="mt-2 gap-2 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
              <Text className="text-base font-semibold text-neutral-900 dark:text-white">
                {t('listing.foundationRisk.title')}
              </Text>
              {listing.foundationRisk.label ? (
                <Text className="text-sm text-neutral-700 dark:text-neutral-300">
                  {listing.foundationRisk.label}
                </Text>
              ) : null}
              {listing.foundationRisk.soilType || listing.foundationRisk.pre1970Pct != null ? (
                <View className="flex-row flex-wrap gap-x-6 gap-y-2">
                  {listing.foundationRisk.soilType ? (
                    <Stat
                      label={t('listing.foundationRisk.soilType')}
                      value={listing.foundationRisk.soilType}
                    />
                  ) : null}
                  {listing.foundationRisk.pre1970Pct != null ? (
                    <Stat
                      label={t('listing.foundationRisk.pre1970')}
                      value={`${Math.round(listing.foundationRisk.pre1970Pct)}%`}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {listing.description ? (
            <Text className="text-base leading-6 text-neutral-700 dark:text-neutral-300">
              {listing.description}
            </Text>
          ) : null}

          {listing.sources?.length ? (
            <View className="mt-2 flex-row gap-3">
              {listing.sources.map((source, i) => (
                <Pressable
                  key={`${source.url}-${i}`}
                  accessibilityRole="link"
                  onPress={() => {
                    trackOutboundLink(source.url, source.name, i + 1);
                    void openBrowserAsync(withUtmParams(source.url));
                  }}
                  className="flex-1 items-center rounded-full bg-blue-600 py-3 active:opacity-80">
                  <Text className="text-base font-semibold text-white text-center">
                    {t('listing.visitRealtor', { name: source.name })}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View className="mt-1 h-64 w-full overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <LocationMap
              latitude={listing.location.latitude}
              longitude={listing.location.longitude}
              mapStyle={maptilerBasicStyle as unknown as StyleSpecification}
              interactive
            />
          </View>
        </View>
      </ScrollView>
    </>
  );
}

type FactRow = {
  label: string;
  value: string;
  /** When set, the value renders as an energy-label arrow bar in this color. */
  badgeColor?: string;
  icon: ComponentType<{ color: string; size?: number }>;
};

/**
 * The listing's key facts as a borderless two-column grid, one icon +
 * value/label cell per fact. An odd fact count leaves the last row's right
 * cell empty.
 */
function FactsTable({ facts, isDark }: { facts: FactRow[]; isDark: boolean }) {
  const iconColor = isDark ? Brand.blueLight : Brand.blue;
  return (
    <View className="mt-2 flex-row flex-wrap">
      {facts.map((s) => {
        const Icon = s.icon;
        return (
          <View key={s.label} className="w-1/2 flex-row items-center gap-3 py-3 pr-3">
            <Icon color={iconColor} size={26} />
            <View className="flex-1 gap-0.5">
              {s.badgeColor ? (
                <EnergyLabelBar value={s.value} color={s.badgeColor} />
              ) : (
                <Text className="text-base font-semibold text-neutral-900 dark:text-white">
                  {s.value}
                </Text>
              )}
              <Text className="text-xs text-neutral-500">{s.label}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// The energy-label arrow bar mirrors the official EU label chevrons: a flat
// left edge and a right-pointing 90° tip (both slopes at 45°), tinted by
// rating. The tip is a border-drawn triangle, same trick as ShareIcon.
const ENERGY_BAR_HEIGHT = 22;

function EnergyLabelBar({ value, color }: { value: string; color: string }) {
  return (
    <View className="flex-row self-start">
      <View
        className="min-w-8 items-center justify-center pl-2 pr-1"
        style={{ height: ENERGY_BAR_HEIGHT, backgroundColor: color }}>
        <Text className="text-sm font-bold text-white">{value}</Text>
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: ENERGY_BAR_HEIGHT / 2,
          borderBottomWidth: ENERGY_BAR_HEIGHT / 2,
          borderLeftWidth: ENERGY_BAR_HEIGHT / 2,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
        }}
      />
    </View>
  );
}

function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View className="gap-0.5">
      <Text
        className="text-base font-semibold text-neutral-900 dark:text-white"
        style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </Text>
      <Text className="text-xs text-neutral-500">{label}</Text>
    </View>
  );
}

// Energy labels run from green (most efficient) to red (least efficient). The
// base letter drives the color; any "+" suffix (A+, A++, …) stays as green as A.
const ENERGY_LABEL_COLORS: Record<string, string> = {
  A: '#16a34a', // green
  B: '#65a30d', // lime
  C: '#ca8a04', // yellow
  D: '#ea580c', // orange
  E: '#f97316', // deep orange
  F: '#dc2626', // red
  G: '#b91c1c', // dark red
};

function energyLabelColor(label: string): string | undefined {
  const letter = label.trim().charAt(0).toUpperCase();
  return ENERGY_LABEL_COLORS[letter];
}
