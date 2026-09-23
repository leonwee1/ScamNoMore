import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Polygon, Text as SvgText } from 'react-native-svg';
import { colors, font, RiskLevel, riskColor, spacing } from '../theme';

/**
 * Speedometer-style gauge showing the probability that something is a scam.
 *
 * The dial is a 180° arc split into the five risk bands used by
 * riskFromProbability() in src/services/analysis.ts, with a needle pointing at
 * the measured probability. Colour + needle position + the numeric readout all
 * encode the same value, so the meaning never depends on colour alone.
 */

/** Risk bands in ascending order; boundaries mirror riskFromProbability(). */
export const RISK_BANDS: Array<{ level: RiskLevel; from: number; to: number }> = [
  { level: 'safe', from: 0, to: 0.2 },
  { level: 'low', from: 0.2, to: 0.4 },
  { level: 'medium', from: 0.4, to: 0.65 },
  { level: 'high', from: 0.65, to: 0.85 },
  { level: 'critical', from: 0.85, to: 1 },
];

/**
 * Map a 0..1 probability to an angle in degrees on the dial.
 * 0 -> 180° (far left), 1 -> 0° (far right).
 */
export function angleForProbability(p: number): number {
  const clamped = Math.min(1, Math.max(0, p));
  return 180 - clamped * 180;
}

/** Convert a polar coordinate on the dial to SVG cartesian space. */
export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

/**
 * Build an SVG arc path sweeping clockwise from startAngle to endAngle
 * (angles in degrees, measured counter-clockwise from the positive x-axis).
 */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = Math.abs(startAngle - endAngle) > 180 ? 1 : 0;
  // sweep=1 draws clockwise, i.e. from the left of the dial towards the right.
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export const RiskGauge: React.FC<{
  probability: number;
  level: RiskLevel;
  label: string;
  /** Localized screen-reader description. Falls back to an English sentence. */
  a11yLabel?: string;
  size?: number;
}> = ({ probability, level, label, a11yLabel, size = 240 }) => {
  const width = size;
  const strokeWidth = Math.round(size * 0.1);
  const cx = width / 2;
  const r = (width - strokeWidth) / 2 - 2;
  const cy = r + strokeWidth / 2 + 2;
  // Semicircle plus room for the readout beneath the dial.
  const height = cy + strokeWidth / 2 + Math.round(size * 0.2);

  const needleAngle = angleForProbability(probability);
  const activeColor = riskColor(level);
  const pct = Math.round(Math.min(1, Math.max(0, probability)) * 100);

  // Needle geometry: a slim triangle from the hub out towards the dial.
  const needleLength = r - strokeWidth * 0.85;
  const tip = polarToCartesian(cx, cy, needleLength, needleAngle);
  const baseL = polarToCartesian(cx, cy, size * 0.03, needleAngle + 90);
  const baseR = polarToCartesian(cx, cy, size * 0.03, needleAngle - 90);

  return (
    <View style={styles.wrap}>
      <Svg
        width={width}
        height={height}
        accessibilityLabel={a11yLabel ?? `${label}. ${pct} percent scam probability.`}
      >
        {/* Track + coloured risk bands */}
        <G>
          <Path
            d={arcPath(cx, cy, r, 180, 0)}
            stroke={colors.surfaceAlt}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
          {RISK_BANDS.map((band) => {
            const a1 = angleForProbability(band.from);
            const a2 = angleForProbability(band.to);
            const isActive = band.level === level;
            return (
              <Path
                key={band.level}
                d={arcPath(cx, cy, r, a1, a2)}
                stroke={riskColor(band.level)}
                strokeWidth={isActive ? strokeWidth : strokeWidth * 0.55}
                strokeOpacity={isActive ? 1 : 0.35}
                fill="none"
              />
            );
          })}
        </G>

        {/* Scale end labels */}
        <SvgText x={strokeWidth / 2} y={cy + strokeWidth} fill={colors.textMuted} fontSize={font.small}>
          0%
        </SvgText>
        <SvgText
          x={width - strokeWidth / 2}
          y={cy + strokeWidth}
          fill={colors.textMuted}
          fontSize={font.small}
          textAnchor="end"
        >
          100%
        </SvgText>

        {/* Needle */}
        <Polygon
          points={`${tip.x},${tip.y} ${baseL.x},${baseL.y} ${baseR.x},${baseR.y}`}
          fill={activeColor}
        />
        <Circle cx={cx} cy={cy} r={size * 0.045} fill={activeColor} />
        <Circle cx={cx} cy={cy} r={size * 0.02} fill={colors.surface} />
      </Svg>

      {/* Numeric readout + verdict, so colour is never the only cue */}
      <View style={styles.readout}>
        <Text style={[styles.pct, { color: activeColor }]}>{pct}%</Text>
        <Text style={[styles.label, { color: activeColor }]}>{label}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xs },
  readout: { alignItems: 'center', marginTop: -spacing.lg },
  pct: { fontSize: 34, fontWeight: '800' },
  label: { fontSize: font.h3, fontWeight: '700', textAlign: 'center' },
});
