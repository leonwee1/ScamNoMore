import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '../components/BrandMark';
import { ComfortNote } from '../components/ComfortNote';
import { Dropdown, DropdownOption } from '../components/Dropdown';
import { ScreenHeader } from '../components/ScreenHeader';
import { Body, Button, Card, Muted } from '../components/ui';
import { scamStore, scamTypes, towns } from '../data/scamStore';
import { useI18n } from '../i18n';
import { useDomain } from '../i18n/useDomain';
import { DatePicker } from '../components/DatePicker';
import { deviceToday } from '../services/dates';
import { api } from '../services/api';
import { colors, font, radius, spacing } from '../theme';
import { scaled, useTextScale } from '../textScale';

const MAX_WORDS = 200;
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/**
 * Report screen (wireframe): mandatory date (default today), 200-word incident
 * description, town + scam-type dropdowns. On submit it persists an unverified
 * row through the shared backend, then shows the thank-you + 1799 helpline.
 */
export const ReportScreen: React.FC = () => {
  const { t } = useI18n();
  const domain = useDomain();
  const { scale } = useTextScale();
  const allTowns = useMemo(() => towns(), []);
  const allTypes = useMemo(() => scamTypes(), []);

  const [date, setDate] = useState(deviceToday());
  const [description, setDescription] = useState('');
  const [town, setTown] = useState<string | undefined>();
  const [scamType, setScamType] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
  const submit = async () => {
    if (!valid || !town || !scamType || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Do not add a local-only row. The response has the stable ID that every
      // device receives from GET /reports after restarting Expo.
      const report = await api.createReport({ dateReported: date, scamType, town, description });
      scamStore.upsertReport(report);
      setDate(deviceToday());
      setDescription('');
      setTown(undefined);
      setScamType(undefined);
      setSubmitted(true);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not submit this report. Please try again.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  // Drop the confirmation when the user leaves the tab, so returning later shows
  // a clean form rather than a stale "thank you" for a report already filed.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setSubmitted(false);
        setSubmitError(null);
      };
    }, [])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          stickyHeaderIndices={[0]}
        >
        <ScreenHeader title={t('app.name')} titleIcon={<BrandMark size={34} />} />

        {submitted ? (
          <View style={styles.successBox}>
            <Body style={styles.successTitle}>🙏 {t('report.thankYou')}</Body>
            <Muted style={styles.successNote}>{t('report.submittedAgain')}</Muted>
          </View>
        ) : null}

        <Card>
          <ComfortNote />
        </Card>

        {submitError ? <Muted style={styles.error}>{submitError}</Muted> : null}

        {/* Keep all four required fields in one visual block. The controls stay
            separate for accessibility and validation; only their surrounding
            card is shared to make the form read as one report. */}
        <Card>
          <View style={styles.formFields}>
            <View>
              <View style={styles.requiredLabelRow}>
                <Muted style={styles.requiredLabel}>{t('report.date')}</Muted>
                <Muted>{t('search.required')}</Muted>
              </View>
              <DatePicker
                value={date}
                onChange={setDate}
                maxDate={deviceToday()}
                accessibilityLabel={t('report.date')}
              />
            </View>

            {/* Dropdowns rather than chip grids: 40 towns and 14 scam types as
                chips filled most of the screen. The option VALUES stay canonical
                English, only the labels are translated, so a report filed in
                Tamil lands in the same dataset rows as an English one. */}
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

            <View style={styles.labelRow}>
              <View style={styles.requiredLabelRow}>
                <Muted style={styles.requiredLabel}>{t('report.description')}</Muted>
                <Muted>{t('search.required')}</Muted>
              </View>
              <Muted style={{ color: words > MAX_WORDS ? colors.high : colors.textMuted }}>
                {Math.max(0, MAX_WORDS - words)} {t('common.wordsLeft')}
              </Muted>
            </View>
            <TextInput
              style={[styles.input, styles.textarea, { fontSize: scaled(font.body, scale), lineHeight: scaled(21, scale) }]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('report.descriptionPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              onFocus={() => requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))}
            />
          </View>
        </Card>

        <Button
          title={t('report.submit')}
          onPress={submit}
          disabled={!valid || submitting}
          loading={submitting}
        />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  requiredLabelRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  formFields: { gap: spacing.md },
  requiredLabel: { color: colors.text, fontWeight: '800' },
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
  // Light green keeps the acknowledgement distinct while preserving readable
  // contrast for both the confirmation and the follow-up note.
  successBox: {
    backgroundColor: '#E8F7EF',
    borderColor: colors.safe,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  successTitle: { color: '#176B4D', fontWeight: '800' },
  successNote: { color: '#345D50' },
  error: { color: colors.high },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
