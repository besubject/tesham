import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BookingItemDto } from '../types';
import { StatusBadge } from './StatusBadge';
import { borderRadius, colors, shadow, spacing, typography } from './theme';

interface BookingCardProps {
  booking: BookingItemDto;
  onPress?: () => void;
  onCancel?: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatPrice(price: number): string {
  return `${price.toLocaleString('ru-RU')} ₽`;
}

export function BookingCard({ booking, onPress, onCancel }: BookingCardProps): React.JSX.Element {
  const canCancel = booking.status === 'confirmed';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={`Запись в ${booking.business_name}`}
      accessibilityRole="button"
    >
      <View style={styles.header}>
        <Text style={styles.businessName} numberOfLines={1}>{booking.business_name}</Text>
        <StatusBadge status={booking.status} />
      </View>

      <Text style={styles.service}>{booking.service_name}</Text>
      <Text style={styles.staff}>Мастер: {booking.staff_name}</Text>

      <View style={styles.footer}>
        <View style={styles.dateRow}>
          <Text style={styles.date}>{formatDate(booking.slot_date)}</Text>
          <Text style={styles.time}>{booking.slot_start_time.slice(0, 5)}</Text>
        </View>
        <Text style={styles.price}>{formatPrice(booking.service_price)}</Text>
      </View>

      {canCancel && onCancel && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={(e) => {
            e.stopPropagation?.();
            onCancel();
          }}
          accessibilityLabel="Отменить запись"
        >
          <Text style={styles.cancelText}>Отменить</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  businessName: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  service: {
    ...typography.body,
    color: colors.text,
  },
  staff: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  date: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  time: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  price: {
    ...typography.label,
    color: colors.accent,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  cancelText: {
    ...typography.label,
    color: colors.coral,
  },
});
