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
import { scaled, useTextScale } from '../textScale';

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
}> = ({ title, onPress, variant = 'primary', loading, disabled, style }) => {
  const { scale } = useTextScale();
  return (
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
          style={[styles.btnText, { fontSize: scaled(16, scale) }, variant === 'secondary' && { color: colors.primary }]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
};

export const Heading: React.FC<{ children: React.ReactNode; style?: TextStyle }> = ({
  children,
  style,
}) => {
  const { scale } = useTextScale();
  return <Text style={[styles.h1, { fontSize: scaled(font.h1, scale) }, style]}>{children}</Text>;
};

export const SubHeading: React.FC<{ children: React.ReactNode; style?: TextStyle }> = ({
  children,
  style,
}) => {
  const { scale } = useTextScale();
  return <Text style={[styles.h2, { fontSize: scaled(font.h2, scale) }, style]}>{children}</Text>;
};

export const Body: React.FC<{
  children: React.ReactNode;
  style?: TextStyle;
  numberOfLines?: number;
}> = ({ children, style, numberOfLines }) => {
  const { scale } = useTextScale();
  return (
    <Text style={[styles.body, { fontSize: scaled(16, scale), lineHeight: scaled(23, scale) }, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
};

export const Muted: React.FC<{
  children: React.ReactNode;
  style?: TextStyle;
  numberOfLines?: number;
}> = ({ children, style, numberOfLines }) => {
  const { scale } = useTextScale();
  return (
    <Text style={[styles.muted, { fontSize: scaled(14, scale), lineHeight: scaled(21, scale) }, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
};

/** Simple horizontal bar row for statistics lists. */
export const StatBar: React.FC<{ label: string; value: number; max: number }> = ({
  label,
  value,
  max,
}) => {
  const { scale } = useTextScale();
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { fontSize: scaled(font.small, scale) }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.statTrack}>
        <View style={[styles.statFill, { width: `${Math.max(4, (value / max) * 100)}%` }]} />
      </View>
      <Text style={[styles.statValue, { fontSize: scaled(font.small, scale) }]}>{value}</Text>
    </View>
  );
};

// ChipSelect was removed once every caller moved to a control that scales to
// long option lists: Dropdown (Search, Report) and WheelPicker (Community). A
// grid of 40 town chips filled most of a phone screen.

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  btn: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
  },
  btnPrimary: { backgroundColor: colors.primary, elevation: 2 },
  btnSecondary: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.85 },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },
  h1: { color: colors.text, fontSize: font.h1, fontWeight: '800', letterSpacing: 0.1 },
  h2: { color: colors.text, fontSize: font.h2, fontWeight: '700' },
  body: { color: colors.text, fontSize: 16, lineHeight: 23 },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  statLabel: { color: colors.text, fontSize: font.small, width: 120 },
  statTrack: { flex: 1, height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  statFill: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },
  statValue: { color: colors.textMuted, fontSize: font.small, width: 44, textAlign: 'right' },
});
