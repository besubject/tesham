import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from './theme';
import type { BookingStatus } from '../types';

interface StatusBadgeProps {
  status: BookingStatus | 'open' | 'closed';
}

const STATUS_CONFIG: Record<BookingStatus | 'open' | 'closed', { label: string; bg: string; text: string }> = {
  confirmed: { label: 'Подтверждено', bg: colors.accentLight, text: colors.accent },
  cancelled: { label: 'Отменено', bg: colors.coralLight, text: colors.coral },
  completed: { label: 'Завершено', bg: colors.surfaceAlt, text: colors.textSecondary },
  no_show: { label: 'Не явился', bg: colors.amberLight, text: colors.amber },
  open: { label: 'Открыто', bg: colors.accentLight, text: colors.accent },
  closed: { label: 'Закрыто', bg: colors.coralLight, text: colors.coral },
};

export function StatusBadge({ status }: StatusBadgeProps): React.JSX.Element {
  const config = STATUS_CONFIG[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.label, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
  },
});
