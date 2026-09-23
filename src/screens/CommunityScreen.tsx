import React, { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTranslatedGuidance } from '../components/useTranslatedGuidance';
import { WheelPicker } from '../components/WheelPicker';
import { Body, Button, Card, Muted, SubHeading } from '../components/ui';
import { scamTypes } from '../data/scamStore';
import { useI18n } from '../i18n';
import { useDomain } from '../i18n/useDomain';
import { colors, font, radius, spacing } from '../theme';

interface Msg {
  who: string;
  text: string;
  self?: boolean;
}

/**
 * Seed messages per room so a joined chat feels alive (wireframe example).
 *
 * Keyed by the CANONICAL English scam type, matching the dataset. The values are
 * translation keys rather than literal text, so the sample conversation appears
 * in the selected language.
 */
const SEED_KEYS: Record<string, string[]> = {
  'E-commerce Scam': [
    'community.seed.ecom.a',
    'community.seed.ecom.b',
    'community.seed.ecom.c',
  ],
  'Phishing Scam': ['community.seed.phish.a', 'community.seed.phish.b'],
  'Job Scam': ['community.seed.job.a', 'community.seed.job.b'],
};

const SPEAKERS = ['A', 'B', 'C'];

/**
 * Community screen (wireframe): pick a chat room by Scam Type, enter the room,
 * see a live chat session with sample messages, post basic messages, and exit.
 */
export const CommunityScreen: React.FC = () => {
  const { t } = useI18n();
  const domain = useDomain();
  const allTypes = useMemo(() => scamTypes(), []);
  // Start on the SECOND type, not the first. The wheel centres the selection, so
  // starting at index 0 would leave the row above it blank; index 1 fills all
  // three visible rows straight away. It also means the guidance box is
  // populated on arrival rather than empty.
  const [room, setRoom] = useState<string | undefined>(() => {
    const types = scamTypes();
    return types[1] ?? types[0];
  });
  const guidance = useTranslatedGuidance(room);
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const enter = () => {
    if (!room) return;
    const keys = SEED_KEYS[room];
    const seeded: Msg[] = keys
      ? keys.map((key, i) => ({ who: SPEAKERS[i] ?? 'A', text: t(key) }))
      : [
          // The generic opener names the scam type, so translate the type too.
          {
            who: 'A',
            text: t('community.seed.generic.a', { type: domain.scamType(room) }),
          },
          { who: 'B', text: t('community.seed.generic.b') },
        ];
    setMessages(seeded);
    setJoined(true);
  };

  const exit = () => {
    setJoined(false);
    setMessages([]);
    setDraft('');
  };

  const send = () => {
    if (!draft.trim()) return;
    setMessages((m) => [...m, { who: t('community.you'), text: draft.trim(), self: true }]);
    setDraft('');
  };

  if (joined && room) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Same fix as the Chatbot screen: without a behavior set, Android
            applies no keyboard avoidance at all and the keyboard draws over the
            input. No keyboardVerticalOffset here — unlike Chatbot this is a tab
            screen with no native header, and KeyboardAvoidingView measures from
            its own frame, which already sits above the bottom tab bar. */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            <ScreenHeader title={t('tab.community')} />
            <Card>
              <SubHeading>
                {t('community.youAreIn')}: {domain.scamType(room)} {t('community.roomSuffix')}
              </SubHeading>
              <Muted>{t('community.liveSession')}</Muted>
            </Card>

            {messages.map((m, i) => (
              <View
                key={i}
                style={[styles.bubble, m.self ? styles.bubbleSelf : styles.bubbleOther]}
              >
                <Muted style={{ color: m.self ? colors.white : colors.primary }}>{m.who}</Muted>
                <Body style={m.self ? { color: colors.white } : undefined}>{m.text}</Body>
              </View>
            ))}

            <Muted>{t('community.etiquette')}</Muted>
            <Button title={t('community.exit')} variant="secondary" onPress={exit} />
          </ScrollView>

          {/* Pinned below the scroll area, mirroring the Chatbot layout, so the
              input is never scrolled out of reach. */}
          <View style={styles.inputBar}>
            <ChatInput value={draft} onChange={setDraft} onSend={send} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('tab.community')} />
        <Card>
          <SubHeading>{t('community.pickRoom')}</SubHeading>
          <Muted>{t('report.scamType')}</Muted>
          {/* A wheel instead of 14 chips: the full list stays reachable in five
              rows, and the centred row is the selection. */}
          <WheelPicker
            options={allTypes.map((v) => ({ value: v, label: domain.scamType(v) }))}
            value={room}
            onChange={setRoom}
          />
        </Card>

        {guidance ? (
          <Card>
            <SubHeading>{domain.scamType(room!)}</SubHeading>
            <Muted>{t('community.aboutScam')}</Muted>
            <Body>{guidance.what}</Body>
            <View style={styles.guidanceGap}>
              <Muted>{t('community.howToHandle')}</Muted>
              <Body>{guidance.how}</Body>
            </View>
            {guidance.translating ? <Muted>{t('analyze.translating')}</Muted> : null}
          </Card>
        ) : null}

        <Button title={t('community.enter')} onPress={enter} disabled={!room} />
      </ScrollView>
    </SafeAreaView>
  );
};

// Local import kept at bottom to avoid clutter above.
import { TextInput } from 'react-native';
const ChatInput: React.FC<{ value: string; onChange: (v: string) => void; onSend: () => void }> = ({
  value,
  onChange,
  onSend,
}) => {
  const { t } = useI18n();
  return (
    <View style={{ gap: spacing.sm }}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={t('community.typeMessage')}
        placeholderTextColor={colors.textMuted}
      />
      <Button title={t('community.send')} onPress={onSend} disabled={!value.trim()} />
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.md },
  inputBar: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  bubble: { borderRadius: radius.md, padding: spacing.md, maxWidth: '90%', gap: 2 },
  bubbleOther: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start' },
  bubbleSelf: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
  guidanceGap: { marginTop: spacing.sm, gap: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: font.body,
    backgroundColor: colors.surfaceAlt,
  },
});
