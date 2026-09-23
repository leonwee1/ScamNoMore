import React, { useCallback, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme';
import { Body, Button, SubHeading } from './ui';

type DeferredUpload = () => void | Promise<void>;

/**
 * Shows a clear, per-upload consent step immediately before raw media leaves
 * the device. Consent is deliberately not remembered: every new file/recording
 * gets the same opportunity to be cancelled or redacted first.
 */
export function useMediaPrivacyConsent(): {
  requestConsent: (upload: DeferredUpload) => void;
  consentDialog: React.ReactNode;
} {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const pending = useRef<DeferredUpload | undefined>(undefined);

  const requestConsent = useCallback((upload: DeferredUpload) => {
    pending.current = upload;
    setVisible(true);
  }, []);

  const cancel = useCallback(() => {
    pending.current = undefined;
    setVisible(false);
  }, []);

  const accept = useCallback(() => {
    const upload = pending.current;
    pending.current = undefined;
    setVisible(false);
    if (upload) void upload();
  }, []);

  const consentDialog = (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cancel}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog} accessibilityRole="alert">
          <SubHeading>{t('analyze.privacy.title')}</SubHeading>
          <Body>{t('analyze.privacy.body')}</Body>
          <Body style={styles.warning}>{t('analyze.privacy.redact')}</Body>
          <View style={styles.actions}>
            <Button title={t('common.cancel')} onPress={cancel} variant="secondary" style={styles.action} />
            <Button title={t('analyze.privacy.continue')} onPress={accept} style={styles.action} />
          </View>
        </View>
      </View>
    </Modal>
  );

  return { requestConsent, consentDialog };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  warning: { color: colors.medium, fontWeight: '700' },
  actions: { gap: spacing.sm },
  action: { width: '100%' },
});
