import React, { useCallback, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme';
import { Body, Button, SubHeading } from './ui';

type DeferredUpload = () => void | Promise<void>;
type MediaKind = 'image' | 'audio' | 'video';

/**
 * Shows a clear consent step immediately before raw media leaves the device.
 * Once accepted, the consent covers the follow-up transcript analysis for the
 * same screen session. Screens reset it when the user chooses new media.
 */
export function useMediaPrivacyConsent(kind: MediaKind): {
  requestConsent: (upload: DeferredUpload, force?: boolean) => void;
  resetConsent: () => void;
  consentDialog: React.ReactNode;
} {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [consented, setConsented] = useState(false);
  const pending = useRef<DeferredUpload | undefined>(undefined);

  const requestConsent = useCallback((upload: DeferredUpload, force = false) => {
    if (consented && !force) {
      void upload();
      return;
    }
    pending.current = upload;
    setVisible(true);
  }, [consented]);

  const resetConsent = useCallback(() => {
    setConsented(false);
  }, []);

  const cancel = useCallback(() => {
    pending.current = undefined;
    setVisible(false);
  }, []);

  const accept = useCallback(() => {
    const upload = pending.current;
    pending.current = undefined;
    setVisible(false);
    setConsented(true);
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
          <Body style={styles.warning}>
            {kind === 'image'
              ? t('analyze.privacy.imageWarning')
              : t('analyze.privacy.audioVideoWarning')}
          </Body>
          <View style={styles.actions}>
            <Button title={t('common.cancel')} onPress={cancel} variant="secondary" style={styles.action} />
            <Button title={t('analyze.privacy.continue')} onPress={accept} style={styles.action} />
          </View>
        </View>
      </View>
    </Modal>
  );

  return { requestConsent, resetConsent, consentDialog };
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
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  warning: {
    color: colors.medium,
    fontWeight: '700',
    backgroundColor: '#3B2A12',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.medium,
    padding: spacing.md,
  },
  actions: { gap: spacing.sm },
  action: { width: '100%' },
});
