import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { Body, Button, Card, ChipSelect, Muted, SubHeading } from '../components/ui';
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
  const [room, setRoom] = useState<string | undefined>();
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');

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
        <ScrollView contentContainerStyle={styles.content}>
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
          <ChipSelect
            options={allTypes}
            value={room}
            onChange={setRoom}
            labelOf={domain.scamType}
          />
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
        placeholder={t('community.typeMessage')}
        placeholderTextColor={colors.textMuted}
      />
      <Button title={t('community.send')} onPress={onSend} disabled={!value.trim()} />
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
