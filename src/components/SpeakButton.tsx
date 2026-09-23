import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useI18n } from '../i18n';
import { hasVoiceFor, speak, stop } from '../services/speech';
import { colors } from '../theme';

/**
 * Speaker button that reads passages aloud in the selected language.
 *
 * Exists for users who can read little of any of the four languages — the
 * findings and advice are the part of a scam warning that actually changes
 * behaviour, and they are useless if unreadable.
 */
export const SpeakButton: React.FC<{
  /** Passages to read, in order. Each is split into sentences internally. */
  passages: string[];
  /** Called with a message when the device has no voice for this language. */
  onUnavailable?: (message: string) => void;
}> = ({ passages, onUnavailable }) => {
  const { t, lang } = useI18n();
  const [speaking, setSpeaking] = useState(false);

  // Never let speech outlive the screen: without this, navigating away mid-read
  // leaves a disembodied voice talking over the next page.
  useEffect(() => {
    return () => stop();
  }, []);

  // Switching language mid-read would continue in the old voice, so stop.
  useEffect(() => {
    stop();
    setSpeaking(false);
  }, [lang]);

  const toggle = async () => {
    if (speaking) {
      stop();
      setSpeaking(false);
      return;
    }

    if (!(await hasVoiceFor(lang))) {
      onUnavailable?.(t('analyze.speechUnavailable'));
      return;
    }

    setSpeaking(true);
    await speak(passages, lang, {
      onDone: () => setSpeaking(false),
      onError: () => {
        setSpeaking(false);
        onUnavailable?.(t('analyze.speechUnavailable'));
      },
    });
  };

  return (
    <Pressable
      onPress={toggle}
      style={[styles.btn, speaking && styles.btnActive]}
      accessibilityRole="button"
      accessibilityLabel={speaking ? t('analyze.stopListening') : t('analyze.listen')}
      accessibilityState={{ selected: speaking }}
      // Extends the tappable area beyond the visible circle, for unsteady taps.
      hitSlop={12}
    >
      <Text style={[styles.icon, speaking && styles.iconActive]}>
        {speaking ? '■' : '🔊'}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // Sized well above the 44pt accessibility minimum: this is the control
  // elderly and low-literacy users depend on most, so it should be the most
  // obvious thing in the card after the gauge.
  btn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  // Roughly double the old size, which was body text at 15pt.
  icon: { fontSize: 30, color: colors.primary, lineHeight: 34 },
  iconActive: { color: colors.white },
});
