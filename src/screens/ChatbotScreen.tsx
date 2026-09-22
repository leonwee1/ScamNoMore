import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Button, Muted } from '../components/ui';
import { useI18n } from '../i18n';
import { aws, ChatTurn } from '../services/aws';
import { colors, font, radius, spacing } from '../theme';

/** Bedrock-backed chatbot for scam Q&A and awareness tips. */
export const ChatbotScreen: React.FC = () => {
  const { t } = useI18n();
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      role: 'assistant',
      content:
        'Hi! I\u2019m the ScamNoMore assistant. Ask me anything about scams, or describe a message/call and I\u2019ll help you spot red flags.',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async () => {
    const message = draft.trim();
    if (!message || loading) return;
    const next: ChatTurn[] = [...turns, { role: 'user', content: message }];
    setTurns(next);
    setDraft('');
    setLoading(true);
    try {
      const reply = await aws.chat(message, next);
      setTurns((cur) => [...cur, { role: 'assistant', content: reply }]);
    } catch (e) {
      // Surface the real reason (e.g. backend not configured) instead of a
      // canned reply, so a broken setup is never mistaken for a real answer.
      setTurns((cur) => [
        ...cur,
        {
          role: 'assistant',
          content: `⚠️ ${e instanceof Error ? e.message : 'I had trouble responding. Please try again.'}`,
        },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {turns.map((turn, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                turn.role === 'user' ? styles.user : styles.assistant,
              ]}
            >
              <Body style={turn.role === 'user' ? { color: colors.white } : undefined}>
                {turn.content}
              </Body>
            </View>
          ))}
          {loading ? <Muted>Assistant is typing…</Muted> : null}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about a scam…"
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Button title="Send" onPress={send} loading={loading} style={{ paddingHorizontal: 18 }} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.md },
  bubble: { borderRadius: radius.md, padding: spacing.md, maxWidth: '88%' },
  user: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
  assistant: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: font.body,
    backgroundColor: colors.surfaceAlt,
    minHeight: 48,
  },
});
