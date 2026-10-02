import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useI18n } from '../i18n';
import { hasVoiceFor, speak, stop } from '../services/speech';
import { colors } from '../theme';
import { useVoiceAssistant } from './VoiceAssistantProvider';
import { subscribeVoiceActions, VoiceAction } from '../services/voiceBus';

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
  /** Optional voice-bus action handled only while this screen is focused. */
  voiceAction?: VoiceAction;
}> = ({ passages, onUnavailable, voiceAction }) => {
  const { t, lang } = useI18n();
  const { pause: pauseHans, resume: resumeHans } = useVoiceAssistant();
  const [speaking, setSpeaking] = useState(false);
  // Keep the current playback state outside the effect closures.  This lets
  // screen navigation clean up only speech that this button actually owns;
  // mounting a new button must never cancel Hans' response in progress.
  const speakingRef = useRef(false);
  const previousLangRef = useRef(lang);
  speakingRef.current = speaking;

  // Never let speech outlive the screen: without this, navigating away mid-read
  // leaves a disembodied voice talking over the next page.
  useEffect(() => {
    return () => {
      if (speakingRef.current) {
        void stop().finally(resumeHans);
      }
    };
  }, [resumeHans]);

  // Switching language mid-read would continue in the old voice, so stop.
  // Do not call stop() on the initial mount: result screens can mount while
  // Hans is speaking a navigation/privacy response.
  useEffect(() => {
    if (previousLangRef.current !== lang) {
      previousLangRef.current = lang;
      if (speakingRef.current) {
        void stop().finally(resumeHans);
        speakingRef.current = false;
        setSpeaking(false);
      }
    }
  }, [lang, resumeHans]);

  const toggle = async () => {
    if (speaking) {
      void stop().finally(resumeHans);
      setSpeaking(false);
      return;
    }

    // Analysis-result audio and Hans share the same microphone/audio session.
    // Release Hans before playback so recognition cannot interrupt the result.
    pauseHans();
    if (!(await hasVoiceFor(lang))) {
      onUnavailable?.(t('analyze.speechUnavailable'));
      resumeHans();
      return;
    }

    setSpeaking(true);
    void speak(passages, lang, {
      onDone: () => {
        setSpeaking(false);
        resumeHans();
      },
      onError: () => {
        setSpeaking(false);
        onUnavailable?.(t('analyze.speechUnavailable'));
        resumeHans();
      },
    });
  };

  useEffect(() => {
    if (!voiceAction) return undefined;
    return subscribeVoiceActions((action) => {
      // Each screen opts into its own action name, so analysis playback cannot
      // be consumed by Community guidance (and vice versa). Avoid relying on
      // nested navigator focus here: the speaker is a child of the focused
      // screen and some web/native navigation layouts report that child as
      // unfocused even while it is visible.
      if (action === voiceAction && !speaking) void toggle();
    });
  }, [passages, lang, speaking, voiceAction]);

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
