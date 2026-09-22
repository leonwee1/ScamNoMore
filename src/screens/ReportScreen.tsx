import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { Body, Button, Card, ChipSelect, Muted, SubHeading } from '../components/ui';
import { scamStore, scamTypes, towns } from '../data/scamStore';
import { useI18n } from '../i18n';
import { colors, font, radius, spacing } from '../theme';

const MAX_WORDS = 200;
const todayISO = () => new Date().toISOString().slice(0, 10);
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/**
 * Report screen (wireframe): mandatory date (default today), 200-word incident
 * description, town + scam-type dropdowns. On submit it appends to the SAME
 * dataset as the 5000 mockup rows (scamStore.addReport), then shows the
 * thank-you + comforting message with the 1799 helpline.
 */
export const ReportScreen: React.FC = () => {
  const { t } = useI18n();
  const allTowns = useMemo(() => towns(), []);
  const allTypes = useMemo(() => scamTypes(), []);

  const [date, setDate] = useState(todayISO());
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
    setDate(todayISO());
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
          <Muted>Total cases in database: {scamStore.count()}</Muted>
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
            placeholder="YYYY-MM-DD"
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
            placeholder="Describe what happened (key info like amount, platform, contact)…"
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </Card>

        <Card>
          <Muted>{t('report.town')} *</Muted>
          <ChipSelect options={allTowns} value={town} onChange={setTown} />
        </Card>

        <Card>
          <Muted>{t('report.scamType')} *</Muted>
          <ChipSelect options={allTypes} value={scamType} onChange={setScamType} />
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
