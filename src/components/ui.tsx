import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, font, radius, RiskLevel, riskColor, spacing } from '../theme';

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => <View style={[styles.card, style]}>{children}</View>;

export const Button: React.FC<{
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}> = ({ title, onPress, variant = 'primary', loading, disabled, style }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={title}
    disabled={disabled || loading}
    onPress={onPress}
    style={({ pressed }) => [
      styles.btn,
      variant === 'primary' ? styles.btnPrimary : styles.btnSecondary,
      (disabled || loading) && styles.btnDisabled,
      pressed && !disabled && styles.btnPressed,
      style,
    ]}
  >
    {loading ? (
      <ActivityIndicator color={colors.white} />
    ) : (
      <Text
        style={[
          styles.btnText,
          variant === 'secondary' && { color: colors.primary },
        ]}
      >
        {title}
      </Text>
    )}
  </Pressable>
);

export const Heading: React.FC<{ children: React.ReactNode; style?: TextStyle }> = ({
  children,
  style,
}) => <Text style={[styles.h1, style]}>{children}</Text>;

export const SubHeading: React.FC<{ children: React.ReactNode; style?: TextStyle }> = ({
  children,
  style,
}) => <Text style={[styles.h2, style]}>{children}</Text>;

export const Body: React.FC<{
  children: React.ReactNode;
  style?: TextStyle;
  numberOfLines?: number;
}> = ({ children, style, numberOfLines }) => (
  <Text style={[styles.body, style]} numberOfLines={numberOfLines}>
    {children}
  </Text>
);

export const Muted: React.FC<{
  children: React.ReactNode;
  style?: TextStyle;
  numberOfLines?: number;
}> = ({ children, style, numberOfLines }) => (
  <Text style={[styles.muted, style]} numberOfLines={numberOfLines}>
    {children}
  </Text>
);

/** Colored risk badge + probability bar for analysis results. */
export const RiskMeter: React.FC<{ probability: number; level: RiskLevel; label: string }> = ({
  probability,
  level,
  label,
}) => {
  const c = riskColor(level);
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.riskRow}>
        <View style={[styles.badge, { backgroundColor: c }]}>
          <Text style={styles.badgeText}>{Math.round(probability * 100)}%</Text>
        </View>
        <Text style={[styles.riskLabel, { color: c }]}>{label}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${Math.round(probability * 100)}%`, backgroundColor: c }]}
        />
      </View>
    </View>
  );
};

/** Simple horizontal bar row for statistics lists. */
export const StatBar: React.FC<{ label: string; value: number; max: number }> = ({
  label,
  value,
  max,
}) => (
  <View style={styles.statRow}>
    <Text style={styles.statLabel} numberOfLines={1}>
      {label}
    </Text>
    <View style={styles.statTrack}>
      <View style={[styles.statFill, { width: `${Math.max(4, (value / max) * 100)}%` }]} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

/** Lightweight dropdown replacement (no native modules) built from chips. */
export const ChipSelect: React.FC<{
  options: string[];
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ options, value, onChange }) => (
  <View style={styles.chipWrap}>
    {options.map((opt) => {
      const active = opt === value;
      return (
        <Pressable
          key={opt}
          onPress={() => onChange(opt)}
          style={[styles.chip, active && styles.chipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
        >
          <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  btn: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.85 },
  btnText: { color: colors.white, fontSize: font.body, fontWeight: '700' },
  h1: { color: colors.text, fontSize: font.h1, fontWeight: '800' },
  h2: { color: colors.text, fontSize: font.h2, fontWeight: '700' },
  body: { color: colors.text, fontSize: font.body, lineHeight: 21 },
  muted: { color: colors.textMuted, fontSize: font.small, lineHeight: 19 },
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: colors.white, fontWeight: '800' },
  riskLabel: { fontSize: font.h3, fontWeight: '700' },
  track: { height: 10, backgroundColor: colors.surfaceAlt, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  statLabel: { color: colors.text, fontSize: font.small, width: 120 },
  statTrack: { flex: 1, height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  statFill: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },
  statValue: { color: colors.textMuted, fontSize: font.small, width: 44, textAlign: 'right' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  chipTextActive: { color: colors.white },
});
