import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Lang, useI18n } from '../i18n';
import { colors, font, radius, spacing } from '../theme';
import { scaled, useTextScale } from '../textScale';

/**
 * Calendar date field. Tapping it opens a month grid instead of asking the user
 * to type YYYY-MM-DD.
 *
 * Hand-built rather than using a native picker, for the same reason as the
 * Dropdown and WheelPicker in this app: the platform pickers look and behave
 * differently on iOS, Android and the web, and this runs in all three. It also
 * makes it straightforward to forbid future dates, which a reported incident can
 * never have.
 */

/** BCP-47 tags for month and weekday names. */
const LOCALES: Record<Lang, string> = {
  en: 'en-SG',
  zh: 'zh-CN',
  ms: 'ms-MY',
  ta: 'ta-IN',
};

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * Month and year heading, localized when the runtime supports it.
 *
 * Wrapped because Intl is only partially implemented in some React Native
 * engines; a numeric fallback is always readable rather than crashing.
 */
function monthLabel(year: number, month: number, lang: Lang): string {
  try {
    return new Date(year, month, 1).toLocaleDateString(LOCALES[lang], {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return `${year}-${pad(month + 1)}`;
  }
}

/** Weekday initials starting Sunday, localized where possible. */
function weekdayLabels(lang: Lang): string[] {
  try {
    // 2023-01-01 was a Sunday, so this walks Sun..Sat.
    return Array.from({ length: 7 }, (_, i) =>
      new Date(2023, 0, 1 + i).toLocaleDateString(LOCALES[lang], { weekday: 'narrow' })
    );
  } catch {
    return ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  }
}

export const DatePicker: React.FC<{
  /** Current value as YYYY-MM-DD. */
  value: string;
  onChange: (value: string) => void;
  /** Latest selectable date, inclusive. Defaults to no limit. */
  maxDate?: string;
  /** Earliest selectable date, inclusive. */
  minDate?: string;
  accessibilityLabel?: string;
}> = ({ value, onChange, maxDate, minDate, accessibilityLabel }) => {
  const { lang } = useI18n();
  const { scale } = useTextScale();
  const [open, setOpen] = useState(false);

  // Month currently on display, seeded from the selected value.
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const initialYear = parsed ? Number(parsed[1]) : new Date().getFullYear();
  const initialMonth = parsed ? Number(parsed[2]) - 1 : new Date().getMonth();
  const [view, setView] = useState({ year: initialYear, month: initialMonth });

  const weekdays = useMemo(() => weekdayLabels(lang), [lang]);

  /** Day cells for the visible month, padded so the 1st lands on its weekday. */
  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1).getDay();
    const days = new Date(view.year, view.month + 1, 0).getDate();
    const out: Array<number | null> = Array.from({ length: first }, () => null);
    for (let d = 1; d <= days; d++) out.push(d);
    return out;
  }, [view]);

  const disabled = (day: number) => {
    const d = iso(view.year, view.month, day);
    if (maxDate && d > maxDate) return true;
    if (minDate && d < minDate) return true;
    return false;
  };

  const shift = (by: number) => {
    const m = view.month + by;
    setView({
      year: view.year + Math.floor(m / 12),
      month: ((m % 12) + 12) % 12,
    });
  };

  return (
    <>
      <Pressable
        onPress={() => {
          // Reopen on the month of whatever is currently selected.
          setView({ year: initialYear, month: initialMonth });
          setOpen(true);
        }}
        style={styles.field}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ? `${accessibilityLabel}: ${value}` : value}
      >
        <Text style={[styles.fieldText, { fontSize: scaled(font.body, scale) }]}>{value}</Text>
        <Text style={[styles.fieldIcon, { fontSize: scaled(font.h3, scale) }]}>📅</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.navRow}>
              <Pressable onPress={() => shift(-1)} style={styles.navBtn} hitSlop={8}>
                <Text style={[styles.navText, { fontSize: scaled(font.h2, scale) }]}>‹</Text>
              </Pressable>
              <Text style={[styles.monthText, { fontSize: scaled(font.h3, scale) }]}>{monthLabel(view.year, view.month, lang)}</Text>
              <Pressable onPress={() => shift(1)} style={styles.navBtn} hitSlop={8}>
                <Text style={[styles.navText, { fontSize: scaled(font.h2, scale) }]}>›</Text>
              </Pressable>
            </View>

            <View style={styles.grid}>
              {weekdays.map((w, i) => (
                <View key={`w${i}`} style={styles.cell}>
                  <Text style={[styles.weekday, { fontSize: scaled(font.small, scale) }]}>{w}</Text>
                </View>
              ))}

              {cells.map((day, i) => {
                if (day === null) return <View key={`p${i}`} style={styles.cell} />;
                const d = iso(view.year, view.month, day);
                const isSelected = d === value;
                const isOff = disabled(day);
                return (
                  <Pressable
                    key={d}
                    disabled={isOff}
                    onPress={() => {
                      onChange(d);
                      setOpen(false);
                    }}
                    style={[styles.cell, isSelected && styles.cellSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled: isOff }}
                    accessibilityLabel={d}
                  >
                    <Text
                      style={[
                        styles.day,
                        { fontSize: scaled(font.body, scale) },
                        isSelected && styles.daySelected,
                        isOff && styles.dayOff,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const CELL = 42;

const styles = StyleSheet.create({
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
  },
  fieldText: { color: colors.text, fontSize: font.body },
  fieldIcon: { fontSize: font.h3 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignSelf: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  navBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  navText: { color: colors.primary, fontSize: font.h2, fontWeight: '800' },
  monthText: { color: colors.text, fontSize: font.h3, fontWeight: '800' },
  // 7 cells per row, sized so the whole month fits without scrolling.
  grid: { width: CELL * 7, flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: colors.primary, borderRadius: radius.sm },
  weekday: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  day: { color: colors.text, fontSize: font.body },
  daySelected: { color: colors.white, fontWeight: '800' },
  // Future dates stay visible but clearly unavailable, which explains itself
  // better than hiding them would.
  dayOff: { color: colors.border },
});
