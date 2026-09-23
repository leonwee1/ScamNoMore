import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';

export interface DropdownOption {
  /** Canonical value stored and filtered on. */
  value: string;
  /** Translated text shown to the user. */
  label: string;
}

/**
 * Select control backed by a modal list.
 *
 * Built rather than pulled in: the platform pickers render very differently
 * across iOS, Android and the browser, and this app has to look the same in all
 * three (it runs in Expo Go and as a web build). A modal list also gives rows
 * large enough for elderly users, which a compact native picker wheel does not.
 *
 * `value` and the argument to `onChange` are always the canonical value, never
 * the translated label, so switching language never changes what gets filtered.
 */
export const Dropdown: React.FC<{
  label: string;
  /** e.g. "Required" / "Optional" — shown muted beside the label. */
  hint?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
}> = ({ label, hint, value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>

      <Pressable
        onPress={() => setOpen(true)}
        style={styles.field}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? ''}`}
      >
        <Text style={styles.fieldText} numberOfLines={1}>
          {current?.label ?? ''}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {/* Tapping the backdrop dismisses, which is what users expect and
            avoids needing a visible cancel button. */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView style={styles.list}>
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={[styles.row, active && styles.rowActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.rowText, active && styles.rowTextActive]}>
                      {opt.label}
                    </Text>
                    {active ? <Text style={styles.tick}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  label: { color: colors.text, fontSize: font.small, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: font.small },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    gap: spacing.sm,
  },
  fieldText: { color: colors.text, fontSize: font.body, flex: 1 },
  caret: { color: colors.textMuted, fontSize: font.body },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    maxHeight: '70%',
  },
  sheetTitle: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: '800',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    // Tall rows: easier to hit, and readable at a glance.
    minHeight: 48,
    gap: spacing.sm,
  },
  rowActive: { backgroundColor: colors.surfaceAlt },
  rowText: { color: colors.text, fontSize: font.body, flex: 1 },
  rowTextActive: { color: colors.primary, fontWeight: '700' },
  tick: { color: colors.primary, fontSize: font.body, fontWeight: '800' },
});
