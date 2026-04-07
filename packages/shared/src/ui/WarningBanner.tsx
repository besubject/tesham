import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from './theme';

type BannerVariant = 'info' | 'warning' | 'error' | 'success';

interface WarningBannerProps {
  variant?: BannerVariant;
  message: string;
  onDismiss?: () => void;
}

const VARIANT_CONFIG: Record<BannerVariant, { bg: string; text: string; icon: string }> = {
  info: { bg: colors.blueLight, text: colors.blue, icon: 'ℹ' },
  warning: { bg: colors.amberLight, text: colors.amber, icon: '⚠' },
  error: { bg: colors.coralLight, text: colors.coral, icon: '✕' },
  success: { bg: colors.accentLight, text: colors.accent, icon: '✓' },
};

export function WarningBanner({
  variant = 'warning',
  message,
  onDismiss,
}: WarningBannerProps): React.JSX.Element {
  const config = VARIANT_CONFIG[variant];

  return (
    <View style={[styles.banner, { backgroundColor: config.bg }]}>
      <Text style={[styles.icon, { color: config.text }]}>{config.icon}</Text>
      <Text style={[styles.message, { color: config.text }]}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.dismissButton}
          accessibilityLabel="Закрыть"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.dismissIcon, { color: config.text }]}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  icon: {
    ...typography.bodyMedium,
    fontWeight: '700',
    marginTop: 1,
  },
  message: {
    ...typography.bodySmall,
    flex: 1,
    lineHeight: 20,
  },
  dismissButton: {
    padding: 2,
  },
  dismissIcon: {
    fontSize: 12,
    fontWeight: '600',
  },
});
