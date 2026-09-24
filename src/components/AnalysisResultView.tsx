import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n';
import { useDomain } from '../i18n/useDomain';
import { AnalysisResult, isAssessed, riskLabelKey } from '../services/analysis';
import { colors, spacing } from '../theme';
import { RiskGauge } from './RiskGauge';
import { SpeakButton } from './SpeakButton';
import { Body, Card, Muted, SubHeading } from './ui';
import { useTranslatedAnalysis } from './useTranslatedAnalysis';

/**
 * Renders the scam-analysis result exactly as the wireframe describes: a
 * probability of it being a scam, the reasoning behind it, and clear advice.
 *
 * Localization has two separate sources:
 *  - Headings and the risk label come from the i18n dictionaries.
 *  - `reasons` / `advice` are written by the model, which is instructed to reply
 *    in the selected language (see backend/src/lib/prompts.ts).
 *  - `scamType` arrives as a canonical English enum value and is translated
 *    here via the domain tables, so the category never depends on the model
 *    getting the target language right.
 *
 * An inconclusive result is special: it has no probability or gauge, and tells
 * the user why the evidence could not be assessed safely.
 */
export const AnalysisResultView: React.FC<{ result: AnalysisResult }> = ({ result }) => {
  const { t } = useI18n();
  const domain = useDomain();
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);

  const assessed = isAssessed(result);
  const unableReason = result.signals?.unableToAssessReason;
  const noSpeech = unableReason === 'no-speech';
  const insufficientEvidence = unableReason === 'insufficient-evidence';
  const source = result.signals?.source;

  // A scoreless response should still identify the evidence whenever the
  // analyzer has text to work with. This is especially important for audio and
  // video: the transcript is visible above the result, but a vague fallback
  // alone would not tell the user what was actually considered.
  const evidenceText = !noSpeech && !assessed ? result.detectedText?.trim() : undefined;
  const evidenceQuote = evidenceText
    ? `${evidenceText.replace(/\s+/g, ' ').slice(0, 280)}${evidenceText.length > 280 ? '…' : ''}`
    : null;
  const evidenceReason = evidenceQuote
    ? t('analyze.unable.evidenceReason', { quote: evidenceQuote })
    : null;

  // Re-translates the model's prose when the user switches language, so the
  // findings never sit in a different language from the headings above them.
  const translated = useTranslatedAnalysis(result);

  const reasons = !assessed
    ? noSpeech
      ? [
          t('analyze.noSpeech.reason'),
          source === 'video' ? t('analyze.noSpeech.video') : t('analyze.noSpeech.voice'),
        ]
      : [
          ...(evidenceReason ? [evidenceReason] : []),
          ...(result.reasons.length
            ? result.reasons
            : [
                insufficientEvidence
                  ? t('analyze.unable.insufficientReason')
                  : t('analyze.unable.invalidReason'),
              ]),
        ]
    : translated.reasons;

  const advice = !assessed
    ? noSpeech
      ? source === 'video'
        ? t('analyze.noSpeech.adviceVideo')
        : t('analyze.noSpeech.adviceVoice')
      : t('analyze.unable.advice')
    : translated.advice;

  const label = assessed ? t(riskLabelKey(result.probability)) : t('analyze.unable.title');
  const pct = assessed ? Math.round(Math.min(1, Math.max(0, result.probability)) * 100) : undefined;

  // Read aloud: the verdict first (the single most important line for someone
  // who cannot read it), then the reasoning and the advice.
  const spokenPassages = [
    assessed ? `${label}. ${pct}% ${t('analyze.probability')}.` : label,
    `${t('analyze.why')}.`,
    ...reasons,
    `${t('analyze.whatToDo')}.`,
    advice,
  ];

  return (
    <Card style={styles.resultCard}>
      <View style={styles.headerRow}>
        <SubHeading>{t('analyze.result')}</SubHeading>
        <SpeakButton passages={spokenPassages} onUnavailable={setSpeechNotice} />
      </View>
      {speechNotice ? <Muted style={styles.notice}>{speechNotice}</Muted> : null}
      {assessed ? (
        <RiskGauge
          probability={result.probability}
          level={result.riskLevel}
          label={label}
          a11yLabel={`${label}. ${pct}% ${t('analyze.probability')}.`}
        />
      ) : (
        <View style={styles.unableBox}>
          <SubHeading style={styles.unableTitle}>{label}</SubHeading>
          <Muted style={styles.unableBody}>{t('analyze.unable.notSafe')}</Muted>
        </View>
      )}
      {assessed && result.scamType ? (
        <Muted>
          {t('analyze.likelyCategory')}: {domain.scamType(result.scamType)}
        </Muted>
      ) : null}

      {translated.translating ? <Muted>{t('analyze.translating')}</Muted> : null}

      <View style={styles.section}>
        <SubHeading>{t('analyze.why')}</SubHeading>
        {reasons.map((r, i) => (
          <Body key={i}>{`\u2022 ${r}`}</Body>
        ))}
      </View>

      <View style={styles.section}>
        <SubHeading>{t('analyze.whatToDo')}</SubHeading>
        <Body>{advice}</Body>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  resultCard: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  section: { gap: spacing.xs, marginTop: spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  notice: { color: colors.medium },
  unableBox: {
    backgroundColor: '#FFF6E2',
    borderColor: '#DCA548',
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.xs,
  },
  unableTitle: { color: '#7A4D00' },
  unableBody: { color: '#4B5C61' },
});
