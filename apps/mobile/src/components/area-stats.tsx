import { useTranslation } from '@huismus/i18n';
import type { NeighborhoodStats } from '@huismus/types';
import { Image } from 'expo-image';
import { useMemo, type ReactNode } from 'react';
import { View, type DimensionValue } from 'react-native';
import { DisplayText, Text } from '@huismus/ui';
import Svg, { Circle } from 'react-native-svg';

import {
  deriveNeighborhoodStats,
  type AgeRow,
  type ElectionPartyRow,
  type StatFormat,
  type StatSegment,
} from '@/lib/neighborhood-stats';
import { useResolvedScheme } from '@/hooks/use-theme';

/**
 * Party logo assets keyed by the slug emitted from `neighborhood-stats`. Metro
 * only bundles statically-analyzable `require` calls, so every party is listed
 * explicitly. Sourced from the StemWijzer 2025 logo set.
 */
const PARTY_LOGOS: Record<string, number> = {
  vvd: require('../../assets/images/party-logos/vvd.png'),
  d66: require('../../assets/images/party-logos/d66.png'),
  pvv: require('../../assets/images/party-logos/pvv.png'),
  'groenlinks-pvda': require('../../assets/images/party-logos/groenlinks-pvda.png'),
  cda: require('../../assets/images/party-logos/cda.png'),
  pvdd: require('../../assets/images/party-logos/pvdd.png'),
  fvd: require('../../assets/images/party-logos/fvd.png'),
  sp: require('../../assets/images/party-logos/sp.png'),
  sgp: require('../../assets/images/party-logos/sgp.png'),
  christenunie: require('../../assets/images/party-logos/christenunie.png'),
  volt: require('../../assets/images/party-logos/volt.png'),
  ja21: require('../../assets/images/party-logos/ja21.png'),
  bvnl: require('../../assets/images/party-logos/bvnl.png'),
  bij1: require('../../assets/images/party-logos/bij1.png'),
  lp: require('../../assets/images/party-logos/lp.png'),
  '50plus': require('../../assets/images/party-logos/50plus.png'),
  piratenpartij: require('../../assets/images/party-logos/piratenpartij.png'),
  fnp: require('../../assets/images/party-logos/fnp.png'),
  'vrij-verbond': require('../../assets/images/party-logos/vrij-verbond.png'),
  'de-linie': require('../../assets/images/party-logos/de-linie.png'),
  denk: require('../../assets/images/party-logos/denk.png'),
  bbb: require('../../assets/images/party-logos/bbb.png'),
  nsc: require('../../assets/images/party-logos/nsc.png'),
  'vrede-voor-dieren': require('../../assets/images/party-logos/vrede-voor-dieren.png'),
};

/*
 * Chart palettes, per theme. `seq` is an ordinal ramp on the brand hue (age
 * bands, construction year); `cat` is a categorical set (household, tenure,
 * dwelling type, origin); `accent` fills the single-series bars; `track` is the
 * unfilled remainder behind every bar and the donut ring.
 *
 * `track` is a step *away* from the card rather than `surface`, which is only
 * ~1.03:1 against `card` in Gloed — a `bg-surface` track would leave the empty
 * part of a bar invisible and make it read as though it ended at its last
 * segment.
 *
 * Theme-aware rather than constant: these marks sit on `bg-card`, which is
 * #FFFFFF in Dageraad and #261F18 in Gloed, and one palette cannot be legible
 * on both. Each set was checked against its own surface for the lightness
 * band, chroma floor, colour-vision separation and contrast — the categorical
 * sets clear an adjacent-pair CVD ΔE of 9.0 (dark) / 11.1 (light), and both
 * ramps are single-hue, monotone in lightness, and clear 2:1 at the end
 * nearest the surface. Re-validate if you touch a value.
 *
 * `cat` deliberately spreads hue rather than staying inside the warm family:
 * four warm tones adjacent in a donut are indistinguishable under protanopia
 * and deuteranopia. Brand red leads; the rest are stepped to match it.
 */
const CHARTS = {
  light: {
    seq: ['#EAA08A', '#E17B60', '#D04A2F', '#A5331F', '#6E2013'],
    cat: ['#D7442E', '#1B8A72', '#C98500', '#6B4E9E'],
    accent: '#D7442E',
    track: '#EFE4D6',
  },
  dark: {
    seq: ['#8E3423', '#B8482F', '#D9694E', '#EC9179', '#F8BFAC'],
    cat: ['#E85B41', '#27967A', '#BC8A12', '#8A79D6'],
    accent: '#E85B41',
    track: '#3A2E24',
  },
} as const;

/** The chart palette for the active theme. */
function useCharts() {
  return CHARTS[useResolvedScheme()];
}

const DONUT = { size: 132, r: 52, c: 66, sw: 17 };
const CIRC = 2 * Math.PI * DONUT.r;

const widthPct = (n: number): DimensionValue => `${n}%` as DimensionValue;

/** Locale-aware number formatters, rebuilt only when the language changes. */
function useFmt() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useMemo(() => {
    const grouped = new Intl.NumberFormat(lang);
    const dec1 = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return {
      count: (n: number) => grouped.format(n),
      grouped: (n: number) => grouped.format(n),
      euroK: (n: number) => `€${grouped.format(Math.round(n))}k`,
      euroKDec: (n: number) => `€${dec1.format(n)}k`,
      percent1: (n: number) => `${dec1.format(n)}%`,
      decimal1: (n: number) => dec1.format(n),
    };
  }, [lang]);
}

type Fmt = ReturnType<typeof useFmt>;

/** Render a value+format pair, or an em dash when the figure is suppressed. */
function formatStat(fmt: Fmt, value: number | null, format: StatFormat): string {
  if (value == null) return '—';
  switch (format) {
    case 'count':
      return fmt.count(value);
    case 'euroK':
      return fmt.euroK(value);
    case 'euroKDec':
      return fmt.euroKDec(value);
    case 'percent':
      return fmt.percent1(value);
  }
}

// --- Building blocks ---------------------------------------------------------

function TileBox({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[46%] flex-1 rounded-2xl border border-border bg-card px-4 py-3 dark:border-border/60 dark:bg-card/80">
      <Text
        numberOfLines={1}
        className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">
        {label}
      </Text>
      <DisplayText className="mt-1 text-2xl font-bold text-ink">{value}</DisplayText>
    </View>
  );
}

function StatCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View className="rounded-2xl border border-border bg-card p-4 dark:border-border/60 dark:bg-card/50">
      <Text className="text-[15px] font-semibold text-ink">{title}</Text>
      {hint ? (
        <Text className="mt-0.5 text-xs text-ink-2">{hint}</Text>
      ) : null}
      <View className="mt-3">{children}</View>
    </View>
  );
}

function Legend({
  items,
  column,
}: {
  items: { label: string; percent: number; color: string }[];
  column?: boolean;
}) {
  return (
    <View className={column ? 'gap-2' : 'mt-3 flex-row flex-wrap gap-x-4 gap-y-2'}>
      {items.map((it) => (
        <View key={it.label} className="flex-row items-center gap-2">
          <View className="h-3 w-3 rounded-sm" style={{ backgroundColor: it.color }} />
          <Text className="text-xs text-ink-2">
            {it.label}{' '}
            <Text className="font-bold text-ink">{it.percent}%</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Stacked horizontal bar for independent or normalized part-to-whole shares. */
function SegmentedBar({
  segments,
  colors,
}: {
  segments: StatSegment[];
  colors: readonly string[];
}) {
  const { t } = useTranslation();
  const { track } = useCharts();
  const legendItems = segments.map((seg, i) => ({
    label: t(`area.stats.${seg.labelKey}`),
    percent: seg.percent,
    color: colors[i % colors.length]!,
  }));
  return (
    <View>
      <View
        className="h-7 flex-row overflow-hidden rounded-lg"
        style={{ backgroundColor: track }}>
        {segments.map((seg, i) => (
          <View
            key={seg.labelKey}
            style={{ width: widthPct(seg.weight), backgroundColor: colors[i % colors.length] }}
          />
        ))}
      </View>
      <Legend items={legendItems} />
    </View>
  );
}

/** Centered horizontal bars; widths are relative to the largest bucket. */
function AgeBars({ rows }: { rows: AgeRow[] }) {
  const { seq } = useCharts();
  const { t } = useTranslation();
  const max = Math.max(...rows.map((r) => r.percent), 1);
  return (
    <View className="gap-3">
      {rows.map((row, i) => (
        <View key={row.labelKey} className="flex-row items-center gap-3">
          <Text className="w-16 text-right text-xs font-semibold text-ink-2">
            {t(`area.stats.${row.labelKey}`)}
          </Text>
          <View className="h-5 flex-1 justify-center">
            <View
              className="h-5 rounded-md"
              style={{
                width: widthPct((row.percent / max) * 100),
                minWidth: 4,
                backgroundColor: seq[seq.length - 1 - i] ?? seq[0],
              }}
            />
          </View>
          <Text className="w-9 text-xs font-bold text-ink">
            {row.percent}%
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Vote share of the top parties: logo, abbreviated name, a horizontal bar
 * scaled so the winning party fills the row, and the percentage of the vote.
 */
function PartyVotes({ parties, fmt }: { parties: ElectionPartyRow[]; fmt: Fmt }) {
  const { accent } = useCharts();
  const max = Math.max(...parties.map((p) => p.share), 1);
  return (
    <View className="gap-2.5">
      {parties.map((party) => (
        <View key={party.label} className="flex-row items-center gap-2.5">
          {party.slug && PARTY_LOGOS[party.slug] ? (
            <Image
              source={PARTY_LOGOS[party.slug]}
              style={{ width: 22, height: 22 }}
              contentFit="contain"
            />
          ) : (
            <View className="h-[22px] w-[22px] rounded-full bg-surface" />
          )}
          <Text
            numberOfLines={1}
            className="w-20 text-xs font-semibold text-ink-2">
            {party.label}
          </Text>
          <View className="h-3 flex-1 justify-center">
            <View
              className="h-3 rounded-full"
              style={{
                width: widthPct((party.share / max) * 100),
                minWidth: 4,
                backgroundColor: accent,
              }}
            />
          </View>
          <Text className="w-14 text-right text-xs font-bold text-ink">
            {fmt.percent1(party.share)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** SVG donut whose arcs are drawn with stroke-dasharray, plus a center stat. */
function Donut({ segments, center }: { segments: StatSegment[]; center?: string }) {
  const { cat, track } = useCharts();
  const arcs = segments.map((seg, i) => {
    const len = (seg.weight / 100) * CIRC;
    // Cumulative length of the preceding arcs, so each arc starts where the last
    // ended. Computed via slice+reduce (no mutation) to satisfy the React
    // Compiler immutability lint; the segment count is tiny.
    const offset = segments
      .slice(0, i)
      .reduce((sum, prev) => sum + (prev.weight / 100) * CIRC, 0);
    return { len, offset, color: cat[i % cat.length]!, key: seg.labelKey };
  });
  return (
    <View style={{ width: DONUT.size, height: DONUT.size }}>
      <Svg width={DONUT.size} height={DONUT.size}>
        <Circle
          cx={DONUT.c}
          cy={DONUT.c}
          r={DONUT.r}
          fill="none"
          stroke={track}
          strokeWidth={DONUT.sw}
        />
        {arcs.map((arc) => (
          <Circle
            key={arc.key}
            cx={DONUT.c}
            cy={DONUT.c}
            r={DONUT.r}
            fill="none"
            stroke={arc.color}
            strokeWidth={DONUT.sw}
            strokeDasharray={`${arc.len} ${CIRC - arc.len}`}
            strokeDashoffset={-arc.offset}
            transform={`rotate(-90, ${DONUT.c}, ${DONUT.c})`}
          />
        ))}
      </Svg>
      {center ? (
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <DisplayText className="text-2xl font-bold text-ink">{center}</DisplayText>
        </View>
      ) : null}
    </View>
  );
}

function ShareBar({ label, value, fmt }: { label: string; value: number; fmt: Fmt }) {
  const { accent, track } = useCharts();
  return (
    <View>
      <View className="flex-row items-baseline justify-between">
        <Text className="text-[13px] text-ink-2">{label}</Text>
        <Text className="text-[13px] font-bold text-ink">
          {fmt.percent1(value)}
        </Text>
      </View>
      <View
        className="mt-1.5 h-3 overflow-hidden rounded-full"
        style={{ backgroundColor: track }}>
        <View
          className="h-3 rounded-full"
          style={{ width: widthPct(value), backgroundColor: accent }}
        />
      </View>
    </View>
  );
}

function MissingState() {
  const { t } = useTranslation();
  return (
    <View className="h-12 items-center justify-center rounded-lg border border-dashed border-border bg-surface">
      <Text className="text-xs italic text-ink-2">
        {t('area.stats.missing')}
      </Text>
    </View>
  );
}

// --- Composed sheet ----------------------------------------------------------

export interface AreaStatsProps {
  /** Stats for the selected area, or null when none are available. */
  stats?: NeighborhoodStats | null;
}

/**
 * Renders one neighborhood's CBS statistics as the curated set of charts from
 * the design: a KPI strip, age bars, a household-composition donut, segmented
 * bars (tenure, dwelling type, origin, construction year), income tiles + share
 * bars, energy tiles, and a district-heating card that demonstrates the
 * suppressed-data state. Each section is omitted when its data is absent;
 * district heating always renders so the "not disclosed" state stays visible.
 */
export function AreaStats({ stats }: AreaStatsProps) {
  const { cat, seq } = useCharts();
  // Before 2000 takes the deeper step, from 2000 the lighter one.
  const buildYear = [seq[3]!, seq[1]!];
  const { t } = useTranslation();
  const fmt = useFmt();
  const view = useMemo(() => deriveNeighborhoodStats(stats), [stats]);

  if (!view || !stats) {
    return (
      <Text className="mt-2 text-base leading-6 text-ink-2">
        {t('area.noStats')}
      </Text>
    );
  }

  return (
    <View className="mt-3 gap-3">
      <View className="flex-row">
        <View className="self-start rounded-full bg-accent/10 px-2.5 py-1">
          <Text className="text-xs font-semibold text-accent-text">
            {`CBS ${stats.statsYear}`}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-3">
        {view.kpis.map((kpi) => (
          <TileBox
            key={kpi.labelKey}
            label={t(`area.stats.${kpi.labelKey}`)}
            value={formatStat(fmt, kpi.value, kpi.format)}
          />
        ))}
      </View>

      {view.age ? (
        <StatCard title={t('area.stats.ageTitle')} hint={t('area.stats.ageHint')}>
          <AgeBars rows={view.age} />
        </StatCard>
      ) : null}

      {view.household ? (
        <StatCard title={t('area.stats.householdTitle')} hint={t('area.stats.householdHint')}>
          <View className="flex-row items-center gap-4">
            <Donut
              segments={view.household.segments}
              center={view.household.size != null ? fmt.decimal1(view.household.size) : undefined}
            />
            <View className="flex-1">
              <Legend
                column
                items={view.household.segments.map((seg, i) => ({
                  label: t(`area.stats.${seg.labelKey}`),
                  percent: seg.percent,
                  color: cat[i % cat.length]!,
                }))}
              />
              <Text className="mt-2 text-[11px] text-ink-2">
                {t('area.stats.householdSizeUnit')}
              </Text>
            </View>
          </View>
        </StatCard>
      ) : null}

      {view.tenure ? (
        <StatCard title={t('area.stats.tenureTitle')} hint={t('area.stats.tenureHint')}>
          <SegmentedBar segments={view.tenure} colors={cat} />
        </StatCard>
      ) : null}

      {view.dwellingType ? (
        <StatCard
          title={t('area.stats.dwellingTypeTitle')}
          hint={t('area.stats.dwellingTypeHint')}>
          <SegmentedBar segments={view.dwellingType} colors={cat} />
        </StatCard>
      ) : null}

      {view.origin ? (
        <StatCard title={t('area.stats.originTitle')} hint={t('area.stats.originHint')}>
          <SegmentedBar segments={view.origin} colors={cat} />
        </StatCard>
      ) : null}

      {view.election ? (
        <StatCard
          title={t('area.stats.electionTitle')}
          hint={t('area.stats.electionHint', {
            year: view.election.period.match(/\d{4}/)?.[0] ?? view.election.period,
          })}>
          <PartyVotes parties={view.election.parties} fmt={fmt} />
        </StatCard>
      ) : null}

      {view.buildYear ? (
        <StatCard title={t('area.stats.buildYearTitle')} hint={t('area.stats.buildYearHint')}>
          <SegmentedBar segments={view.buildYear} colors={buildYear} />
        </StatCard>
      ) : null}

      {view.income ? (
        <StatCard title={t('area.stats.incomeTitle')} hint={t('area.stats.incomeHint')}>
          <View className="flex-row flex-wrap gap-3">
            {view.income.tiles.map((tile) => (
              <TileBox
                key={tile.labelKey}
                label={t(`area.stats.${tile.labelKey}`)}
                value={formatStat(fmt, tile.value, tile.format)}
              />
            ))}
          </View>
          {view.income.shares.length > 0 ? (
            <View className="mt-4 gap-3">
              {view.income.shares.map((share) => (
                <ShareBar
                  key={share.labelKey}
                  label={t(`area.stats.${share.labelKey}`)}
                  value={share.value}
                  fmt={fmt}
                />
              ))}
            </View>
          ) : null}
        </StatCard>
      ) : null}

      {view.energy ? (
        <StatCard title={t('area.stats.energyTitle')} hint={t('area.stats.energyHint')}>
          <View className="flex-row flex-wrap gap-3">
            {view.energy.map((e) => (
              <TileBox
                key={e.labelKey}
                label={t(`area.stats.${e.labelKey}`)}
                value={`${fmt.grouped(e.value)} ${e.unit === 'm3' ? 'm³' : 'kWh'}`}
              />
            ))}
          </View>
        </StatCard>
      ) : null}

      <StatCard
        title={t('area.stats.districtHeatingTitle')}
        hint={t('area.stats.districtHeatingHint')}>
        {view.districtHeating != null ? (
          <DisplayText className="text-2xl font-bold text-ink">
            {`${Math.round(view.districtHeating)}%`}
          </DisplayText>
        ) : (
          <MissingState />
        )}
      </StatCard>
    </View>
  );
}
