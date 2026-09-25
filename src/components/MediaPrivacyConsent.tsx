import React, { useCallback, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
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
          <Body style={styles.beforeContinue}>{t('analyze.privacy.beforeContinue')}</Body>
          <View style={styles.bulletList}>
            <Body style={styles.bullet}>• {t('analyze.privacy.bodyPoint1')}</Body>
            <Body style={styles.bullet}>• {t('analyze.privacy.bodyPoint2')}</Body>
            <Body style={styles.bullet}>• {t('analyze.privacy.bodyPoint3')}</Body>
          </View>
          <View style={styles.warning}>
            <View style={styles.warningTitleRow}>
              <View style={styles.warningIcon}>
                <Text style={styles.warningIconText}>!</Text>
              </View>
              <Body style={styles.warningTitle}>{t('analyze.privacy.warningTitle')}</Body>
            </View>
            <Body style={styles.warningText}>
              • {kind === 'image'
                ? t('analyze.privacy.imageWarningPoint1')
                : t('analyze.privacy.audioVideoWarningPoint1')}
            </Body>
            <Body style={styles.warningText}>
              • {kind === 'image'
                ? t('analyze.privacy.imageWarningPoint2')
                : t('analyze.privacy.audioVideoWarningPoint2')}
            </Body>
          </View>
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
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  beforeContinue: { color: colors.text, fontWeight: '800' },
  bulletList: { gap: spacing.xs },
  bullet: { color: '#345963' },
  warning: {
    backgroundColor: '#FFF1E8',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#E57C43',
    padding: spacing.md,
    gap: spacing.xs,
  },
  warningTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  warningIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E57C43',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningIconText: { color: colors.white, fontSize: 21, fontWeight: '800' },
  warningTitle: { color: '#9A4B22', fontWeight: '800', flex: 1 },
  warningText: {
    color: '#6E3A25',
    paddingLeft: 42,
  },
  actions: { gap: spacing.sm },
  action: { width: '100%' },
});
