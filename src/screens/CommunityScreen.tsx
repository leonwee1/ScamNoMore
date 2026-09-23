import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTranslatedGuidance } from '../components/useTranslatedGuidance';
import { WheelPicker } from '../components/WheelPicker';
import { Body, Button, Card, Muted, SubHeading } from '../components/ui';
import { scamTypes } from '../data/scamStore';
import { useI18n } from '../i18n';
import { useDomain } from '../i18n/useDomain';
import { api, CommunityMessage, CommunityMessageCursor } from '../services/api';
import { colors, font, radius, spacing } from '../theme';

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
  const allTypes = useMemo(() => scamTypes(), []);
  const [room, setRoom] = useState<string | undefined>(() => {
    const types = scamTypes();
    return types[1] ?? types[0];
  });
  const guidance = useTranslatedGuidance(room);
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [nextBefore, setNextBefore] = useState<CommunityMessageCursor | undefined>();
  const [ownMessageIds, setOwnMessageIds] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const loadMessages = async (
    roomKey: string,
    before?: CommunityMessageCursor,
    appendOlder = false
  ) => {
    setLoadingMessages(true);
    setChatError(null);
    try {
      const page = await api.listCommunityMessages(roomKey, before);
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
    setMessages([]);
    setNextBefore(undefined);
    setDraft('');
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
      const message = await api.createCommunityMessage({ roomKey: room, text });
      setMessages((current) => mergeMessages(current, [message]));
      setOwnMessageIds((ids) => new Set([...ids, message.id]));
      setDraft('');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Could not send this message.');
    } finally {
      setSending(false);
    }
  };

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
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            <ScreenHeader title={t('tab.community')} />
            <Card>
              <SubHeading>
                {t('community.youAreIn')}: {domain.scamType(room)} {t('community.roomSuffix')}
              </SubHeading>
              <Muted>{t('community.liveSession')}</Muted>
              <Muted style={styles.publicNotice}>{t('community.publicNotice')}</Muted>
              <Button
                title={t('community.refresh')}
                variant="secondary"
                onPress={() => void loadMessages(room)}
                loading={loadingMessages}
              />
            </Card>

            {chatError ? <Muted style={styles.error}>{chatError}</Muted> : null}
            {loadingMessages && messages.length === 0 ? <Muted>{t('community.loading')}</Muted> : null}
            {!loadingMessages && messages.length === 0 && !chatError ? (
              <Muted>{t('community.noMessages')}</Muted>
            ) : null}

            {messages.map((message) => {
              const self = ownMessageIds.has(message.id);
              return (
                <View
                  key={message.id}
                  style={[styles.bubble, self ? styles.bubbleSelf : styles.bubbleOther]}
                >
                  <Muted style={{ color: self ? colors.white : colors.primary }}>
                    {self ? t('community.you') : t('community.member')}
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

            <Muted>{t('community.etiquette')}</Muted>
            <Button title={t('community.exit')} variant="secondary" onPress={exit} />
          </ScrollView>

          <View style={styles.inputBar}>
            <ChatInput value={draft} onChange={setDraft} onSend={send} sending={sending} />
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
          <WheelPicker
            options={allTypes.map((value) => ({ value, label: domain.scamType(value) }))}
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

const ChatInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
}> = ({ value, onChange, onSend, sending }) => {
  const { t } = useI18n();
  return (
    <View style={{ gap: spacing.sm }}>
      <TextInput
        style={styles.input}
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
  },
  bubble: { borderRadius: radius.md, padding: spacing.md, maxWidth: '90%', gap: 2 },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  bubbleSelf: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
  guidanceGap: { marginTop: spacing.sm, gap: spacing.xs },
  publicNotice: { color: colors.medium },
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
