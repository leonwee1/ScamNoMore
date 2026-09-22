import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AnalysisResult } from '../services/analysis';
import { probabilityLabel } from '../services/aws';
import { spacing } from '../theme';
import { Body, Card, Muted, RiskMeter, SubHeading } from './ui';

/**
 * Renders the scam-analysis result exactly as the wireframe describes: a
 * probability of it being a scam, the reasoning behind it, and clear advice.
 */
export const AnalysisResultView: React.FC<{ result: AnalysisResult }> = ({ result }) => (
  <Card>
    <SubHeading>Analysis result</SubHeading>
    <RiskMeter
      probability={result.probability}
      level={result.riskLevel}
      label={probabilityLabel(result.probability)}
    />
    {result.scamType ? <Muted>Likely category: {result.scamType}</Muted> : null}

    <View style={styles.section}>
      <SubHeading>Why</SubHeading>
      {result.reasons.map((r, i) => (
        <Body key={i}>{`\u2022 ${r}`}</Body>
      ))}
    </View>

    {result.detectedText ? (
      <View style={styles.section}>
        <SubHeading>Detected content</SubHeading>
        <Muted>{result.detectedText}</Muted>
      </View>
    ) : null}

    <View style={styles.section}>
      <SubHeading>What to do</SubHeading>
      <Body>{result.advice}</Body>
    </View>
  </Card>
);

const styles = StyleSheet.create({
  section: { gap: spacing.xs, marginTop: spacing.sm },
});
