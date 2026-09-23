import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n';
import { useDomain } from '../i18n/useDomain';
import { AnalysisResult, riskLabelKey } from '../services/analysis';
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
 * The no-speech case is special: the backend produces it WITHOUT calling the
 * model, so its English text is replaced with localized copy here.
 */
export const AnalysisResultView: React.FC<{ result: AnalysisResult }> = ({ result }) => {
  const { t } = useI18n();
  const domain = useDomain();
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);

  const noSpeech = result.signals?.noSpeechDetected === true;
  const source = result.signals?.source;

  // Re-translates the model's prose when the user switches language, so the
  // findings never sit in a different language from the headings above them.
  const translated = useTranslatedAnalysis(result);

  const reasons = noSpeech
    ? [
        t('analyze.noSpeech.reason'),
        source === 'video' ? t('analyze.noSpeech.video') : t('analyze.noSpeech.voice'),
      ]
    : translated.reasons;

  const advice = noSpeech
    ? source === 'video'
      ? t('analyze.noSpeech.adviceVideo')
      : t('analyze.noSpeech.adviceVoice')
    : translated.advice;

  const label = t(riskLabelKey(result.probability));
  const pct = Math.round(Math.min(1, Math.max(0, result.probability)) * 100);

  // Read aloud: the verdict first (the single most important line for someone
  // who cannot read it), then the reasoning and the advice.
  const spokenPassages = [
    `${label}. ${pct}% ${t('analyze.probability')}.`,
    `${t('analyze.why')}.`,
    ...reasons,
    `${t('analyze.whatToDo')}.`,
    advice,
  ];

  return (
    <Card>
      <View style={styles.headerRow}>
        <SubHeading>{t('analyze.result')}</SubHeading>
        <SpeakButton passages={spokenPassages} onUnavailable={setSpeechNotice} />
      </View>
      {speechNotice ? <Muted style={styles.notice}>{speechNotice}</Muted> : null}
      <RiskGauge
        probability={result.probability}
        level={result.riskLevel}
        label={label}
        a11yLabel={`${label}. ${pct}% ${t('analyze.probability')}.`}
      />
      {result.scamType ? (
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
  section: { gap: spacing.xs, marginTop: spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  notice: { color: colors.medium },
});
