import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '../components/BrandMark';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTranslatedGuidance } from '../components/useTranslatedGuidance';
import { WheelPicker } from '../components/WheelPicker';
import { SpeakButton } from '../components/SpeakButton';
import { Body, Button, Card, Muted, SubHeading } from '../components/ui';
import { scamTypes } from '../data/scamStore';
import { useI18n } from '../i18n';
import { useDomain } from '../i18n/useDomain';
import { api, CommunityMessage, CommunityMessageCursor } from '../services/api';
import { getCommunityParticipantId } from '../services/communityIdentity';
import { colors, font, radius, spacing } from '../theme';
import { scaled, useTextScale } from '../textScale';

/** Keep a server-confirmed row exactly once when a refresh races a send. */
function mergeMessages(
  current: CommunityMessage[],
  incoming: CommunityMessage[]
): CommunityMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return Array.from(byId.values()).sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
}

/**
 * Shared community room. Messages are stored by the backend in the same
 * persistent SQLite database as reports, so exiting/re-entering a room (and a
 * different Expo device opening it) retrieves the same server-confirmed rows.
 */
export const CommunityScreen: React.FC = () => {
  const { t } = useI18n();
  const domain = useDomain();
  const { scale } = useTextScale();
  const allTypes = useMemo(() => scamTypes(), []);
  const [room, setRoom] = useState<string | undefined>(() => {
    const types = scamTypes();
    return types[1] ?? types[0];
  });
  const guidance = useTranslatedGuidance(room);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [handlingOpen, setHandlingOpen] = useState(false);
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [nextBefore, setNextBefore] = useState<CommunityMessageCursor | undefined>();
  const [ownMessageIds, setOwnMessageIds] = useState<Set<string>>(() => new Set());
  const [participantId, setParticipantId] = useState<string>();
  const [draft, setDraft] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const shouldScrollToEndRef = useRef(true);

  const loadMessages = async (
    roomKey: string,
    before?: CommunityMessageCursor,
    appendOlder = false
  ) => {
    if (!appendOlder) shouldScrollToEndRef.current = true;
    setLoadingMessages(true);
    setChatError(null);
    try {
      const page = await api.listCommunityMessages(roomKey, before);
      if (!appendOlder) shouldScrollToEndRef.current = true;
      setMessages((current) => (appendOlder ? mergeMessages(current, page.messages) : page.messages));
      setNextBefore(page.nextBefore);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Could not load this discussion.');
    } finally {
      setLoadingMessages(false);
    }
  };

  const enter = () => {
    if (!room) return;
    shouldScrollToEndRef.current = true;
    setMessages([]);
    setNextBefore(undefined);
    setDraft('');
    // Keep the guidance compact on entry; users can expand either section when
    // they want the details without pushing the conversation off-screen.
    setAboutOpen(false);
    setHandlingOpen(false);
    setJoined(true);
    void loadMessages(room);
  };

  const exit = () => {
    // Only clear the screen state. Messages remain on the shared SQLite service
    // and are reloaded on the next enter, rather than being seeded/reset locally.
    setJoined(false);
    setMessages([]);
    setNextBefore(undefined);
    setDraft('');
    setChatError(null);
  };

  const send = async () => {
    if (!room || !draft.trim() || sending) return;
    const text = draft.trim();
    setSending(true);
    setChatError(null);
    try {
      const senderId = participantId ?? (await getCommunityParticipantId());
      setParticipantId(senderId);
      const message = await api.createCommunityMessage({ roomKey: room, text, participantId: senderId });
      shouldScrollToEndRef.current = true;
      setMessages((current) => mergeMessages(current, [message]));
      setOwnMessageIds((ids) => new Set([...ids, message.id]));
      setDraft('');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Could not send this message.');
    } finally {
      setSending(false);
    }
  };

  const guidancePassages = guidance && room
    ? [
        `${domain.scamType(room)}.`,
        `${t('community.aboutScam')}. ${guidance.what}`,
        `${t('community.howToHandle')}. ${guidance.how}`,
      ]
    : [];

  if (joined && room) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            stickyHeaderIndices={[0]}
            onContentSizeChange={() => {
              if (shouldScrollToEndRef.current) {
                scrollRef.current?.scrollToEnd({ animated: true });
                shouldScrollToEndRef.current = false;
              }
            }}
          >
            <ScreenHeader title={t('app.name')} titleIcon={<BrandMark size={34} />} chatLabel="Ask Hans" />
            <Card>
              <SubHeading>
                {t('community.youAreIn')}: {domain.scamType(room)} {t('community.roomSuffix')}
              </SubHeading>
              <Muted style={styles.publicNotice}>{t('community.publicNotice')}</Muted>
            </Card>

            {guidance ? (
              <Card style={styles.guidanceCard}>
                <View style={styles.guidanceListenRow}>
                  <Muted style={styles.guidanceListenLabel}>{domain.scamType(room)}</Muted>
                  <SpeakButton passages={guidancePassages} onUnavailable={setSpeechNotice} />
                </View>
                {speechNotice ? <Muted style={styles.notice}>{speechNotice}</Muted> : null}
                <Pressable
                  style={styles.guidanceSectionHeader}
                  onPress={() => {
                    shouldScrollToEndRef.current = false;
                    setAboutOpen((open) => !open);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: aboutOpen }}
                >
                  <Muted style={styles.guidanceTitle}>{t('community.aboutScam')}</Muted>
                  <Text style={styles.guidanceChevron}>{aboutOpen ? '⌃' : '›'}</Text>
                </Pressable>
                {aboutOpen ? <Body style={styles.guidanceBody}>{guidance.what}</Body> : null}

                <Pressable
                  style={styles.guidanceSectionHeader}
                  onPress={() => {
                    shouldScrollToEndRef.current = false;
                    setHandlingOpen((open) => !open);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: handlingOpen }}
                >
                  <Muted style={styles.guidanceTitle}>{t('community.howToHandle')}</Muted>
                  <Text style={styles.guidanceChevron}>{handlingOpen ? '⌃' : '›'}</Text>
                </Pressable>
                {handlingOpen ? <Body style={styles.guidanceBody}>{guidance.how}</Body> : null}
                {guidance.translating ? <Muted>{t('analyze.translating')}</Muted> : null}
              </Card>
            ) : null}

            {chatError ? <Muted style={styles.error}>{chatError}</Muted> : null}
            {loadingMessages && messages.length === 0 ? <Muted>{t('community.loading')}</Muted> : null}
            {!loadingMessages && messages.length === 0 && !chatError ? (
              <Muted>{t('community.noMessages')}</Muted>
            ) : null}

            {messages.map((message) => {
              const self = ownMessageIds.has(message.id);
              const participant = message.participantKey
                ? t('community.participant').replace('{id}', message.participantKey)
                : t('community.member');
              return (
                <View
                  key={message.id}
                  style={[styles.bubble, self ? styles.bubbleSelf : styles.bubbleOther]}
                >
                  <Muted style={{ color: self ? colors.white : colors.primary }}>
                    {self ? t('community.you') : participant}
                  </Muted>
                  <Body style={self ? { color: colors.white } : undefined}>{message.text}</Body>
                </View>
              );
            })}

            {nextBefore ? (
              <Button
                title={t('community.loadEarlier')}
                variant="secondary"
                onPress={() => void loadMessages(room, nextBefore, true)}
                loading={loadingMessages}
              />
            ) : null}

          </ScrollView>

          <View style={styles.inputBar}>
            <ChatInput value={draft} onChange={setDraft} onSend={send} sending={sending} />
            <Button title={t('community.exit')} variant="secondary" onPress={exit} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[0]}>
        <ScreenHeader title={t('app.name')} titleIcon={<BrandMark size={34} />} chatLabel="Ask Hans" />
        <Card>
          <SubHeading style={{ fontSize: scaled(18, scale) }}>{t('community.pickRoom')}</SubHeading>
          <WheelPicker
            options={allTypes.map((value) => ({ value, label: domain.scamType(value) }))}
            value={room}
            onChange={(value) => {
              setSpeechNotice(null);
              setRoom(value);
            }}
          />
        </Card>

        {guidance ? (
          <Card>
            <View style={styles.guidanceListenRow}>
              <SubHeading
                style={room === 'Government Officials Impersonation Scam' ? styles.governmentRoomTitle : undefined}
              >
                {domain.scamType(room!)}
              </SubHeading>
              <SpeakButton passages={guidancePassages} onUnavailable={setSpeechNotice} />
            </View>
            {speechNotice ? <Muted style={styles.notice}>{speechNotice}</Muted> : null}
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

const ChatInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
}> = ({ value, onChange, onSend, sending }) => {
  const { t } = useI18n();
  const { scale } = useTextScale();
  return (
    <View style={{ gap: spacing.sm }}>
      <TextInput
        style={[styles.input, { fontSize: scaled(font.body, scale), lineHeight: scaled(21, scale) }]}
        value={value}
        onChangeText={onChange}
        placeholder={t('community.typeMessage')}
        placeholderTextColor={colors.textMuted}
        editable={!sending}
        maxLength={500}
      />
      <Button title={t('community.send')} onPress={onSend} loading={sending} disabled={!value.trim()} />
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
    gap: spacing.md,
  },
  bubble: {
    borderRadius: radius.lg,
    padding: spacing.md,
    maxWidth: '90%',
    gap: spacing.xs,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  bubbleSelf: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
  guidanceGap: { marginTop: spacing.sm, gap: spacing.xs },
  guidanceCard: { gap: spacing.sm },
  guidanceListenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  governmentRoomTitle: { flex: 1, minWidth: 0 },
  guidanceListenLabel: { color: colors.text, fontWeight: '800', flex: 1 },
  guidanceSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  guidanceTitle: { color: colors.primary, fontWeight: '800' },
  guidanceChevron: { color: colors.primary, fontSize: 22, lineHeight: 22 },
  guidanceBody: { color: colors.text, fontSize: font.body, lineHeight: 21 },
  notice: { color: colors.medium },
  // Darker amber keeps the safety notice distinct while meeting readable
  // contrast on the light card surface.
  publicNotice: { color: '#7A4D00', fontWeight: '700' },
  error: { color: colors.high },
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
