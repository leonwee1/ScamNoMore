import React, { useEffect, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, font, radius, spacing } from '../theme';

/**
 * Vertical wheel selector, like a native time picker: the option resting in the
 * centre band is the selected one.
 *
 * Used where a long list of choices would otherwise run to many lines — 14 scam
 * types as tappable chips filled most of the screen. A wheel keeps the whole set
 * reachable in a fixed amount of space.
 */

/** Row height. Also the snap interval, so a row always lands centred. */
const ITEM_H = 44;

/**
 * Rows visible at once. Odd, so exactly one sits in the middle.
 *
 * Three keeps the control compact while still showing a neighbour above and
 * below, which is what signals the list can be scrolled.
 */
const VISIBLE = 3;

const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

export interface WheelOption {
  value: string;
  label: string;
}

export const WheelPicker: React.FC<{
  options: WheelOption[];
  value?: string;
  onChange: (value: string) => void;
}> = ({ options, value, onChange }) => {
  const ref = useRef<ScrollView>(null);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  // Align the wheel with the incoming value, including on first render.
  useEffect(() => {
    ref.current?.scrollTo({ y: index * ITEM_H, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const next = Math.round(y / ITEM_H);
    const clamped = Math.min(options.length - 1, Math.max(0, next));
    const picked = options[clamped];
    if (picked && picked.value !== value) onChange(picked.value);
  };

  /** Tapping an off-centre row scrolls it to the middle. */
  const jumpTo = (i: number) => {
    ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
    // Web has no momentum event, so commit here as well.
    if (Platform.OS === 'web') onChange(options[i].value);
  };

  return (
    <View style={styles.wrap}>
      {/* The centre band sits behind the rows and marks the selected slot. */}
      <View style={styles.band} pointerEvents="none" />

      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        // Momentum fires on native; drag-end covers web and slow drags.
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: PAD }}
        style={styles.scroll}
      >
        {options.map((opt, i) => {
          const active = i === index;
          return (
            <Pressable
              key={opt.value}
              onPress={() => jumpTo(i)}
              style={styles.row}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={opt.label}
            >
              <Text
                style={[styles.label, active ? styles.labelActive : styles.labelIdle]}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    height: VISIBLE * ITEM_H,
    justifyContent: 'center',
    position: 'relative',
  },
  scroll: { flexGrow: 0 },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: PAD,
    height: ITEM_H,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  row: { height: ITEM_H, justifyContent: 'center', paddingHorizontal: spacing.md },
  label: { textAlign: 'center' },
  // The centre row is the only one at full contrast, so the selection is
  // unmistakable without needing a separate confirmation control.
  labelActive: { color: colors.text, fontSize: font.h3, fontWeight: '800' },
  labelIdle: { color: colors.textMuted, fontSize: font.body },
});
