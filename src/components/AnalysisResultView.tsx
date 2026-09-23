import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n';
import { useDomain } from '../i18n/useDomain';
import { AnalysisResult, riskLabelKey } from '../services/analysis';
import { spacing } from '../theme';
import { RiskGauge } from './RiskGauge';
import { Body, Card, Muted, SubHeading } from './ui';

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

  const noSpeech = result.signals?.noSpeechDetected === true;
  const source = result.signals?.source;

  const reasons = noSpeech
    ? [
        t('analyze.noSpeech.reason'),
        source === 'video' ? t('analyze.noSpeech.video') : t('analyze.noSpeech.voice'),
      ]
    : result.reasons;

  const advice = noSpeech
    ? source === 'video'
      ? t('analyze.noSpeech.adviceVideo')
      : t('analyze.noSpeech.adviceVoice')
    : result.advice;

  const label = t(riskLabelKey(result.probability));
  const pct = Math.round(Math.min(1, Math.max(0, result.probability)) * 100);

  return (
    <Card>
      <SubHeading>{t('analyze.result')}</SubHeading>
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
});
