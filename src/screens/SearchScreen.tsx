import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { Body, Button, Card, Muted, StatBar, SubHeading } from '../components/ui';
import { computeStats, searchScams } from '../data/scamStore';
import { ScamRecord } from '../data/types';
import { useI18n } from '../i18n';
import { colors, font, radius, spacing } from '../theme';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Search screen (wireframe): time period + optional keywords + verified-only
 * toggle -> "Go statistics for your search" -> results with a per-town
 * breakdown ("Statistics by Town") and a scrollable case list.
 */
export const SearchScreen: React.FC = () => {
  const { t } = useI18n();
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
              placeholder="From (YYYY-MM-DD)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, styles.dateInput]}
              value={to}
              onChangeText={setTo}
              placeholder="To (YYYY-MM-DD)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
          </View>

          <Muted>{t('search.keywords')}</Muted>
          <TextInput
            style={styles.input}
            value={keywords}
            onChangeText={setKeywords}
            placeholder="e.g. PayNow, Carousell, OTP"
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
              <Body>
                {stats.total} case{stats.total === 1 ? '' : 's'} found
              </Body>
              {stats.total === 0 ? <Muted>{t('search.noResults')}</Muted> : null}
            </Card>

            {stats.total > 0 ? (
              <>
                <Card>
                  <SubHeading>{t('search.byTown')}</SubHeading>
                  {stats.byTown.slice(0, 12).map((row) => (
                    <StatBar key={row.town} label={row.town} value={row.count} max={maxTown} />
                  ))}
                </Card>

                <Card>
                  <SubHeading>Top scam types</SubHeading>
                  {stats.byType.slice(0, 8).map((row) => (
                    <StatBar
                      key={row.type}
                      label={row.type.replace(' Scam', '')}
                      value={row.count}
                      max={stats.byType[0].count}
                    />
                  ))}
                </Card>

                <Card>
                  <SubHeading>Matching cases</SubHeading>
                  {results!.slice(0, 40).map((r) => (
                    <View key={r.id} style={styles.caseRow}>
                      <Body style={{ fontWeight: '700' }}>
                        {r.scamType.replace(' Scam', '')} · {r.town}
                      </Body>
                      <Muted>
                        {r.dateReported} · {r.specificPlace}
                      </Muted>
                      <Muted numberOfLines={1}>{r.keywords.join(', ')}</Muted>
                    </View>
                  ))}
                  {results!.length > 40 ? (
                    <Muted>Showing first 40 of {results!.length}. Refine your search to narrow down.</Muted>
                  ) : null}
                </Card>
              </>
            ) : null}
          </>
        ) : (
          <Muted>Set your filters and tap “{t('search.go')}”.</Muted>
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
