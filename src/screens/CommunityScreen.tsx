import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { Body, Button, Card, ChipSelect, Muted, SubHeading } from '../components/ui';
import { scamTypes } from '../data/scamStore';
import { useI18n } from '../i18n';
import { colors, font, radius, spacing } from '../theme';

interface Msg {
  who: string;
  text: string;
  self?: boolean;
}

/** Seed messages per room so a joined chat feels alive (wireframe example). */
const SEED_MESSAGES: Record<string, Msg[]> = {
  'E-commerce Scam': [
    { who: 'A', text: 'I saw this video on YouTube about a powerful veggie cleaner selling at 60% discount. Does anyone know if it\u2019s real?' },
    { who: 'B', text: 'I have seen this too. Apparently, it\u2019s a scam…' },
    { who: 'C', text: 'Seller asked me to PayNow first and then blocked me. Don\u2019t pay before meetup.' },
  ],
  'Phishing Scam': [
    { who: 'A', text: 'Got an SMS saying my bank account is locked with a link. Looks legit?' },
    { who: 'B', text: 'Banks never send links to unlock accounts. Delete it and call the bank directly.' },
  ],
  'Job Scam': [
    { who: 'A', text: 'A Telegram recruiter offered $80/task, just need to pay a small deposit first.' },
    { who: 'B', text: 'Classic job scam. Real jobs never ask you to pay upfront.' },
  ],
};

const genericSeed = (room: string): Msg[] => [
  { who: 'A', text: `Anyone experienced a ${room.toLowerCase()} recently? Sharing to warn others.` },
  { who: 'B', text: 'Stay alert and verify everything. Report to the police if you lost money.' },
];

/**
 * Community screen (wireframe): pick a chat room by Scam Type, enter the room,
 * see a live chat session with sample messages, post basic messages, and exit.
 */
export const CommunityScreen: React.FC = () => {
  const { t } = useI18n();
  const allTypes = useMemo(() => scamTypes(), []);
  const [room, setRoom] = useState<string | undefined>();
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');

  const enter = () => {
    if (!room) return;
    setMessages(SEED_MESSAGES[room] ?? genericSeed(room));
    setJoined(true);
  };

  const exit = () => {
    setJoined(false);
    setMessages([]);
    setDraft('');
  };

  const send = () => {
    if (!draft.trim()) return;
    setMessages((m) => [...m, { who: 'You', text: draft.trim(), self: true }]);
    setDraft('');
  };

  if (joined && room) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader title={t('tab.community')} />
          <Card>
            <SubHeading>
              {t('community.youAreIn')}: {room} chat room
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

          <Card>
            <ChatInput value={draft} onChange={setDraft} onSend={send} />
            <Muted>{t('community.etiquette')}</Muted>
          </Card>

          <Button title={t('community.exit')} variant="secondary" onPress={exit} />
        </ScrollView>
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
          <ChipSelect options={allTypes} value={room} onChange={setRoom} />
        </Card>
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
        placeholder="Type a message…"
        placeholderTextColor={colors.textMuted}
      />
      <Button title="Send" onPress={onSend} disabled={!value.trim()} />
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  bubble: { borderRadius: radius.md, padding: spacing.md, maxWidth: '90%', gap: 2 },
  bubbleOther: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start' },
  bubbleSelf: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
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
