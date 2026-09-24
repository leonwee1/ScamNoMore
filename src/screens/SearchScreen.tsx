import React, { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown, DropdownOption } from '../components/Dropdown';
import { ScreenHeader } from '../components/ScreenHeader';
import { SingaporeHeatmap } from '../components/SingaporeHeatmap';
import { Body, Button, Card, Muted, SubHeading } from '../components/ui';
import { computeStats, scamStore, scamTypes, searchScams, SearchFilters, towns } from '../data/scamStore';
import { ScamRecord } from '../data/types';
import { useI18n } from '../i18n';
import { useDomain } from '../i18n/useDomain';
import { deviceToday, monthsAgo } from '../services/dates';
import { colors, font, radius, spacing } from '../theme';
import { scaled, useTextScale } from '../textScale';

/** Sentinel for "no filter on this field". Not a real dataset value. */
const ANY = '__any__';

/** Relative periods offered in the Time period dropdown, in months. */
const PERIODS: Array<{ value: string; months: number; key: string }> = [
  { value: '1m', months: 1, key: 'search.period.1m' },
  { value: '3m', months: 3, key: 'search.period.3m' },
  { value: '6m', months: 6, key: 'search.period.6m' },
  { value: '1y', months: 12, key: 'search.period.1y' },
  { value: '2y', months: 24, key: 'search.period.2y' },
  { value: '5y', months: 60, key: 'search.period.5y' },
];

/** Cases revealed per tap, matching the "Show next 5" control. */
const PAGE = 5;

/**
 * Search screen: pick a scam type, a relative time period and optionally a town
 * and keywords, then see where those cases cluster on a map of Singapore
 * alongside the matching records.
 */
export const SearchScreen: React.FC = () => {
  const { t } = useI18n();
  const domain = useDomain();
  const { scale } = useTextScale();

  // Re-render when startup hydration or a confirmed report updates the shared
  // store. A previously-run query then refreshes instead of showing stale data.
  const [storeVersion, setStoreVersion] = useState(0);
  useEffect(() => scamStore.subscribe(() => setStoreVersion((version) => version + 1)), []);

  const allTypes = useMemo(() => scamTypes(), [storeVersion]);
  const allTowns = useMemo(() => towns(), [storeVersion]);

  const [scamType, setScamType] = useState(ANY);
  const [period, setPeriod] = useState('6m');
  const [town, setTown] = useState(ANY);
  const [keywords, setKeywords] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(true);

  const [appliedFilters, setAppliedFilters] = useState<SearchFilters | null>(null);
  /** Zero-based page index. Exactly one page of PAGE cases is on screen. */
  const [page, setPage] = useState(0);

  const typeOptions: DropdownOption[] = [
    { value: ANY, label: t('search.allScamTypes') },
    ...allTypes.map((v) => ({ value: v, label: domain.scamType(v) })),
  ];
  const periodOptions: DropdownOption[] = PERIODS.map((p) => ({
    value: p.value,
    label: t(p.key),
  }));
  const townOptions: DropdownOption[] = [
    { value: ANY, label: t('search.allTowns') },
    ...allTowns.map((v) => ({ value: v, label: domain.town(v) })),
  ];

  const run = () => {
    const months = PERIODS.find((p) => p.value === period)?.months ?? 6;
    const kw = keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    setAppliedFilters({
      // Relative period resolved against the device's own calendar.
      from: monthsAgo(months),
      to: deviceToday(),
      keywords: kw,
      scamType: scamType === ANY ? undefined : scamType,
      town: town === ANY ? undefined : town,
      verifiedOnly,
    });
    setPage(0);
  };

  const results = useMemo(
    () => (appliedFilters ? searchScams(appliedFilters) : null),
    [appliedFilters, storeVersion]
  );
  const stats = useMemo(() => (results ? computeStats(results) : null), [results]);

  // A single window of results, so the list stays exactly one page long instead
  // of growing with every tap.
  const total = results?.length ?? 0;
  const start = page * PAGE;
  const visible = results?.slice(start, start + PAGE) ?? [];
  const remaining = total - (start + visible.length);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('tab.search')} showControls />

        <Card>
          <Dropdown
            label={t('search.scamType')}
            hint={t('search.required')}
            value={scamType}
            options={typeOptions}
            onChange={setScamType}
          />
          <Dropdown
            label={t('search.period')}
            hint={t('search.required')}
            value={period}
            options={periodOptions}
            onChange={setPeriod}
          />
          <Dropdown
            label={t('search.town')}
            hint={t('search.required')}
            value={town}
            options={townOptions}
            onChange={setTown}
          />

          <View style={styles.labelRow}>
            <Text style={[styles.fieldLabel, { fontSize: scaled(font.small, scale) }]}>{t('search.keywords')}</Text>
            <Text style={[styles.fieldHint, { fontSize: scaled(font.small, scale) }]}>{t('search.optional')}</Text>
          </View>
          <TextInput
            style={[styles.input, { fontSize: scaled(font.body, scale) }]}
            value={keywords}
            onChangeText={setKeywords}
            placeholder={t('search.keywordsPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />

          <View style={styles.switchRow}>
            <Body>{t('search.verifiedOnly')}</Body>
            <Switch value={verifiedOnly} onValueChange={setVerifiedOnly} />
          </View>

          <Button title={`${t('search.go')}  →`} onPress={run} />
        </Card>

        {stats ? (
          stats.total === 0 ? (
            <Card>
              <SubHeading>{t('search.results')}</SubHeading>
              <Muted>{t('search.noResults')}</Muted>
            </Card>
          ) : (
            <>
              <Card>
                <SingaporeHeatmap
                  data={stats.byTown.map((r) => ({ town: r.town, count: r.count }))}
                  title={t('search.activityMap')}
                  subtitle={t('search.heatmapBy')}
                  lowerLabel={t('search.lowerActivity')}
                  higherLabel={t('search.higherActivity')}
                />
              </Card>

              <Card>
                <View style={styles.headerRow}>
                  <SubHeading>{t('search.matchingCases')}</SubHeading>
                  <Muted>
                    {t('search.showingCount', {
                      // 1-based and inclusive, so page 2 of five-row pages reads
                      // "6–10 of 506" rather than a static "5".
                      from: start + 1,
                      to: start + visible.length,
                      total,
                    })}
                  </Muted>
                </View>

                {visible.map((r) => (
                  <View key={r.id} style={styles.caseCard}>
                    <Text style={[styles.caseType, { fontSize: scaled(font.body, scale) }]}>{domain.scamType(r.scamType)}</Text>
                    <Muted>
                      {/* specificPlace is a street address or landmark, so it is
                          deliberately left untranslated. */}
                      {r.dateReported} · {domain.town(r.town)} · {r.specificPlace}
                    </Muted>
                    <View style={styles.caseFooter}>
                      <Muted numberOfLines={1} style={styles.caseKeywords}>
                        {domain.keywords(r.keywords).join(', ')}
                      </Muted>
                      {/^https?:\/\//i.test(r.source) ? (
                        <Pressable
                          onPress={() => Linking.openURL(r.source).catch(() => undefined)}
                          accessibilityRole="link"
                          accessibilityLabel={t('search.readSource')}
                          hitSlop={8}
                        >
                          <Text style={[styles.sourceLink, { fontSize: scaled(font.small, scale) }]}>{t('search.readSource')} ↗</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}

                {/* Paging back is offered too: with a fixed window the user
                    would otherwise have no way to return to earlier cases. */}
                {page > 0 ? (
                  <Button
                    title={`←  ${t('search.showPrev', { n: PAGE })}`}
                    variant="secondary"
                    onPress={() => setPage((p) => Math.max(0, p - 1))}
                  />
                ) : null}
                {remaining > 0 ? (
                  <Button
                    title={`${t('search.showNext', { n: Math.min(PAGE, remaining) })}  →`}
                    variant="secondary"
                    onPress={() => setPage((p) => p + 1)}
                  />
                ) : null}
              </Card>
            </>
          )
        ) : (
          <Muted>{t('search.setFilters', { action: t('search.go') })}</Muted>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  fieldLabel: { color: colors.text, fontSize: font.small, fontWeight: '800' },
  fieldHint: { color: colors.textMuted, fontSize: font.small },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: font.body,
    backgroundColor: colors.surfaceAlt,
    minHeight: 48,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  caseCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.xs,
  },
  caseType: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  caseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  caseKeywords: { flex: 1 },
  sourceLink: { color: colors.primary, fontSize: font.small, fontWeight: '700' },
});
