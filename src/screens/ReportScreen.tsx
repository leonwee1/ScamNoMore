import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ComfortNote } from '../components/ComfortNote';
import { Dropdown, DropdownOption } from '../components/Dropdown';
import { ScreenHeader } from '../components/ScreenHeader';
import { Body, Button, Card, Muted } from '../components/ui';
import { scamStore, scamTypes, towns } from '../data/scamStore';
import { useI18n } from '../i18n';
import { useDomain } from '../i18n/useDomain';
import { DatePicker } from '../components/DatePicker';
import { deviceToday, monthsAgo } from '../services/dates';
import { colors, font, radius, spacing } from '../theme';

const MAX_WORDS = 200;
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/**
 * Report screen (wireframe): mandatory date (default today), 200-word incident
 * description, town + scam-type dropdowns. On submit it appends to the SAME
 * dataset as the 5000 mockup rows (scamStore.addReport), then shows the
 * thank-you + comforting message with the 1799 helpline.
 */
export const ReportScreen: React.FC = () => {
  const { t } = useI18n();
  const domain = useDomain();
  const allTowns = useMemo(() => towns(), []);
  const allTypes = useMemo(() => scamTypes(), []);

  const [date, setDate] = useState(deviceToday());
  const [description, setDescription] = useState('');
  const [town, setTown] = useState<string | undefined>();
  const [scamType, setScamType] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // The empty value is the "nothing chosen yet" placeholder. Both fields are
  // mandatory, and `valid` below already rejects an empty selection.
  const townOptions: DropdownOption[] = useMemo(
    () => [
      { value: '', label: t('report.selectTown') },
      ...allTowns.map((v) => ({ value: v, label: domain.town(v) })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTowns, domain.lang]
  );

  const typeOptions: DropdownOption[] = useMemo(
    () => [
      { value: '', label: t('report.selectType') },
      ...allTypes.map((v) => ({ value: v, label: domain.scamType(v) })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTypes, domain.lang]
  );

  const words = wordCount(description);
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    words > 0 &&
    words <= MAX_WORDS &&
    !!town &&
    !!scamType;

  /**
   * File the report, then clear the form and show a confirmation above it.
   *
   * There is deliberately no separate thank-you page and no "Submit another
   * report" button. A full-screen confirmation is a dead end — the only way
   * onward is a button whose sole purpose is to undo the page you just landed on.
   * Resetting the form and placing the acknowledgement at the top of it means the
   * user is already where they would want to be next, and can simply leave via
   * the tab bar if they are done.
   */
  const submit = () => {
    if (!valid || !town || !scamType) return;
    scamStore.addReport({ dateReported: date, scamType, town, description });
    setDate(deviceToday());
    setDescription('');
    setTown(undefined);
    setScamType(undefined);
    setSubmitted(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Drop the confirmation when the user leaves the tab, so returning later shows
  // a clean form rather than a stale "thank you" for a report already filed.
  useFocusEffect(
    useCallback(() => {
      return () => setSubmitted(false);
    }, [])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader title={t('report.title')} />

        {submitted ? (
          <View style={styles.successBox}>
            <Body style={styles.successTitle}>🙏 {t('report.thankYou')}</Body>
            <ComfortNote />
            <Muted>{t('report.submittedAgain')}</Muted>
          </View>
        ) : null}

        <Card>
          <Muted>{t('report.date')} *</Muted>
          {/* maxDate is today: an incident cannot be reported before it happens,
              and blocking it in the calendar is clearer than validating after
              the fact. */}
          <DatePicker
            value={date}
            onChange={setDate}
            maxDate={deviceToday()}
            minDate={monthsAgo(60)}
            accessibilityLabel={t('report.date')}
          />
        </Card>

        {/* Dropdowns rather than chip grids: 40 towns and 14 scam types as chips
            filled most of the screen. Both share one card to save more height.

            Placed before the description so the quick structured fields come
            first and the one open-ended field is last — the user is not left
            writing prose and then discovering more questions below it.

            The option VALUES stay canonical English, only the labels are
            translated, so a report filed in Tamil lands in the same dataset rows
            as an English one and remains searchable. */}
        <Card>
          <Dropdown
            label={t('report.town')}
            hint={t('search.required')}
            value={town ?? ''}
            options={townOptions}
            onChange={(v) => setTown(v || undefined)}
          />
          <Dropdown
            label={t('report.scamType')}
            hint={t('search.required')}
            value={scamType ?? ''}
            options={typeOptions}
            onChange={(v) => setScamType(v || undefined)}
          />
        </Card>

        <Card>
          <View style={styles.labelRow}>
            <Muted>{t('report.description')} *</Muted>
            <Muted style={{ color: words > MAX_WORDS ? colors.high : colors.textMuted }}>
              {Math.max(0, MAX_WORDS - words)} {t('common.wordsLeft')}
            </Muted>
          </View>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('report.descriptionPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </Card>

        {/* Same note as the confirmation above, so the helpline is visible
            whether the user has submitted yet or not. */}
        <Card>
          <ComfortNote />
        </Card>

        <Button title={t('report.submit')} onPress={submit} disabled={!valid} />
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
  textarea: { minHeight: 130, textAlignVertical: 'top' },
  // Green-tinted so the acknowledgement reads as success at a glance, distinct
  // from the neutral cards of the form below it.
  successBox: {
    backgroundColor: '#12372A',
    borderColor: colors.safe,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  successTitle: { color: colors.safe, fontWeight: '800' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
