import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { Body, Button, Card, Muted, StatBar, SubHeading } from '../components/ui';
import { computeStats, searchScams } from '../data/scamStore';
import { ScamRecord } from '../data/types';
import { useI18n } from '../i18n';
import { useDomain } from '../i18n/useDomain';
import { colors, font, radius, spacing } from '../theme';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Search screen (wireframe): time period + optional keywords + verified-only
 * toggle -> "Go statistics for your search" -> results with a per-town
 * breakdown ("Statistics by Town") and a scrollable case list.
 */
export const SearchScreen: React.FC = () => {
  const { t } = useI18n();
  const domain = useDomain();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [keywords, setKeywords] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [results, setResults] = useState<ScamRecord[] | null>(null);

  const run = () => {
    const kw = keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    setResults(
      searchScams({
        from: DATE_RE.test(from) ? from : undefined,
        to: DATE_RE.test(to) ? to : undefined,
        keywords: kw,
        verifiedOnly,
      })
    );
  };

  const stats = useMemo(() => (results ? computeStats(results) : null), [results]);
  const maxTown = stats?.byTown[0]?.count ?? 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('tab.search')} />

        <Card>
          <Muted>{t('search.period')}</Muted>
          <View style={styles.dateRow}>
            <TextInput
              style={[styles.input, styles.dateInput]}
              value={from}
              onChangeText={setFrom}
              placeholder={t('search.from')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, styles.dateInput]}
              value={to}
              onChangeText={setTo}
              placeholder={t('search.to')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
          </View>

          <Muted>{t('search.keywords')}</Muted>
          <TextInput
            style={styles.input}
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

          <Button title={t('search.go')} onPress={run} />
        </Card>

        {stats ? (
          <>
            <Card>
              <SubHeading>{t('search.results')}</SubHeading>
              <Body>{t('search.casesFound', { count: stats.total })}</Body>
              {stats.total === 0 ? <Muted>{t('search.noResults')}</Muted> : null}
            </Card>

            {stats.total > 0 ? (
              <>
                <Card>
                  <SubHeading>{t('search.byTown')}</SubHeading>
                  {stats.byTown.slice(0, 12).map((row) => (
                    <StatBar
                      key={row.town}
                      label={domain.town(row.town)}
                      value={row.count}
                      max={maxTown}
                    />
                  ))}
                </Card>

                <Card>
                  <SubHeading>{t('search.topTypes')}</SubHeading>
                  {stats.byType.slice(0, 8).map((row) => (
                    <StatBar
                      key={row.type}
                      label={domain.scamTypeShort(row.type)}
                      value={row.count}
                      max={stats.byType[0].count}
                    />
                  ))}
                </Card>

                <Card>
                  <SubHeading>{t('search.matchingCases')}</SubHeading>
                  {results!.slice(0, 40).map((r) => (
                    <View key={r.id} style={styles.caseRow}>
                      <Body style={{ fontWeight: '700' }}>
                        {domain.scamTypeShort(r.scamType)} · {domain.town(r.town)}
                      </Body>
                      {/* specificPlace is a street address or landmark
                          ("Blk 101 Ang Mo Kio Ave 3", "VivoCity"). Addresses are
                          not localized — a translated address is harder to act
                          on, not easier. */}
                      <Muted>
                        {r.dateReported} · {r.specificPlace}
                      </Muted>
                      <Muted numberOfLines={1}>{domain.keywords(r.keywords).join(', ')}</Muted>
                    </View>
                  ))}
                  {results!.length > 40 ? (
                    <Muted>
                      {t('search.showingFirst', { shown: 40, total: results!.length })}
                    </Muted>
                  ) : null}
                </Card>
              </>
            ) : null}
          </>
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: font.body,
    backgroundColor: colors.surfaceAlt,
  },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateInput: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  caseRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    gap: 2,
  },
});
