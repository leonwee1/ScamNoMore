import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import {
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  TEXT_SCALE_STEP,
  scaled,
  useTextScale,
} from '../textScale';

/** Compact, touch-friendly text-size control used in the Home utility row. */
export const TextSizeSlider: React.FC<{ dark?: boolean }> = ({ dark = false }) => {
  const { scale, setScale } = useTextScale();
  const [trackWidth, setTrackWidth] = useState(0);
  const ratio = (scale - TEXT_SCALE_MIN) / (TEXT_SCALE_MAX - TEXT_SCALE_MIN);
  const thumbX = trackWidth * ratio;

  const updateFromTouch = (x: number) => {
    if (!trackWidth) return;
    const next = TEXT_SCALE_MIN + (Math.min(trackWidth, Math.max(0, x)) / trackWidth) *
      (TEXT_SCALE_MAX - TEXT_SCALE_MIN);
    setScale(next);
  };

  const onLayout = (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width);

  return (
    <View
      style={styles.wrap}
      accessibilityRole="adjustable"
      accessibilityLabel="Text size"
      // iOS bridges accessibility min/max/now as long integers. Keep the
      // internal multiplier decimal, but expose it as an integer percentage so
      // React Native does not throw a precision-conversion exception.
      accessibilityValue={{
        min: Math.round(TEXT_SCALE_MIN * 100),
        max: Math.round(TEXT_SCALE_MAX * 100),
        now: Math.round(scale * 100),
      }}
      accessibilityActions={[
        { name: 'decrement', label: 'Decrease text size' },
        { name: 'increment', label: 'Increase text size' },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'decrement') setScale(scale - TEXT_SCALE_STEP);
        if (event.nativeEvent.actionName === 'increment') setScale(scale + TEXT_SCALE_STEP);
      }}
    >
      <Text style={[styles.smallA, { fontSize: scaled(13, scale), color: dark ? '#F2F6FA' : colors.text }]}>A</Text>
      <View
        style={styles.trackTouchArea}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => updateFromTouch(event.nativeEvent.locationX)}
        onResponderMove={(event) => updateFromTouch(event.nativeEvent.locationX)}
      >
        <View style={[styles.track, dark && styles.trackDark]} />
        <View style={[styles.thumb, dark && styles.thumbDark, { left: Math.max(0, thumbX - 9) }]} />
      </View>
      <Text style={[styles.largeA, { fontSize: scaled(22, scale), color: dark ? '#F2F6FA' : colors.text }]}>A</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.xs,
  },
  smallA: { color: colors.text, lineHeight: 24 },
  largeA: { color: colors.text, lineHeight: 28 },
  trackTouchArea: {
    // Compact enough to share a row with all four language buttons at the
    // largest text setting, while keeping a generous 32px-high touch area.
    // Short enough to stay beside all four language buttons at the largest
    // language label size, while retaining a comfortable touch target.
    width: 72,
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  track: { height: 4, borderRadius: radius.sm, backgroundColor: colors.textMuted, width: '100%' },
  trackDark: { backgroundColor: '#9DB2C6' },
  thumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.bg,
  },
  thumbDark: { backgroundColor: '#2EA6FF', borderColor: '#0C2233' },
});
