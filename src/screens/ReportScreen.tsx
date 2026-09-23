import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { Body, Button, Card, ChipSelect, Muted, SubHeading } from '../components/ui';
import { scamStore, scamTypes, towns } from '../data/scamStore';
import { useI18n } from '../i18n';
import { useDomain } from '../i18n/useDomain';
import { deviceToday } from '../services/dates';
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

  const words = wordCount(description);
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    words > 0 &&
    words <= MAX_WORDS &&
    !!town &&
    !!scamType;

  const submit = () => {
    if (!valid || !town || !scamType) return;
    scamStore.addReport({ dateReported: date, scamType, town, description });
    setSubmitted(true);
  };

  const reset = () => {
    setDate(deviceToday());
    setDescription('');
    setTown(undefined);
    setScamType(undefined);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader title={t('tab.report')} />
          <Card>
            <SubHeading>🙏 {t('report.thankYou')}</SubHeading>
          </Card>
          <Card>
            <Body>{t('report.comfort')}</Body>
          </Card>
          <Muted>{t('report.totalCases', { count: scamStore.count() })}</Muted>
          <Button title={t('report.another')} onPress={reset} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('report.title')} />

        <Card>
          <Muted>{t('report.date')} *</Muted>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder={t('report.datePlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
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

        {/* labelOf only changes what is DISPLAYED. onChange still yields the
            canonical English value, which is what addReport() stores, so a
            report filed in Tamil lands in the same dataset rows as an English
            one and remains searchable. */}
        <Card>
          <Muted>{t('report.town')} *</Muted>
          <ChipSelect
            options={allTowns}
            value={town}
            onChange={setTown}
            labelOf={domain.town}
          />
        </Card>

        <Card>
          <Muted>{t('report.scamType')} *</Muted>
          <ChipSelect
            options={allTypes}
            value={scamType}
            onChange={setScamType}
            labelOf={domain.scamType}
          />
        </Card>

        <Card>
          <Body>{t('report.comfort')}</Body>
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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
