import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { borderRadius, colors, shadow, spacing, typography } from './theme';

interface CodeConfirmationModalProps {
  visible: boolean;
  title: string;
  message?: string;
  phoneLabel?: string;
  code: string;
  error?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  resendLabel?: string;
  onChangeCode: (code: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onResend: () => void;
  isSubmitting?: boolean;
  isResending?: boolean;
}

export function CodeConfirmationModal({
  visible,
  title,
  message,
  phoneLabel,
  code,
  error,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  resendLabel = 'Отправить код повторно',
  onChangeCode,
  onConfirm,
  onCancel,
  onResend,
  isSubmitting = false,
  isResending = false,
}: CodeConfirmationModalProps): React.JSX.Element {
  const isCodeValid = code.trim().length === 6;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel}
        accessibilityLabel="Закрыть"
      >
        <TouchableOpacity
          style={styles.dialog}
          activeOpacity={1}
          onPress={() => undefined}
        >
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {phoneLabel ? <Text style={styles.phoneLabel}>{phoneLabel}</Text> : null}

          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            value={code}
            onChangeText={(value) => onChangeCode(value.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor={colors.textMuted}
            textAlign="center"
            autoFocus
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.resendButton}
            onPress={onResend}
            disabled={isResending || isSubmitting}
            accessibilityLabel={resendLabel}
          >
            {isResending ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={styles.resendText}>{resendLabel}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isSubmitting || isResending}
              accessibilityLabel={cancelLabel}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                !isCodeValid || isSubmitting ? styles.confirmButtonDisabled : null,
              ]}
              onPress={onConfirm}
              disabled={!isCodeValid || isSubmitting || isResending}
              accessibilityLabel={confirmLabel}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    gap: spacing.sm,
    ...shadow.md,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  phoneLabel: {
    ...typography.bodySmall,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
    ...typography.h3,
    color: colors.text,
    letterSpacing: 6,
  },
  inputError: {
    borderColor: colors.coral,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.coral,
    textAlign: 'center',
  },
  resendButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
  },
  resendText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmButton: {
    backgroundColor: colors.coral,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  cancelText: {
    ...typography.buttonSmall,
    color: colors.text,
  },
  confirmText: {
    ...typography.buttonSmall,
    color: colors.white,
  },
});
