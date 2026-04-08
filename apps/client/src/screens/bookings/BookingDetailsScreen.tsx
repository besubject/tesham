import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  apiClient,
  colors,
  spacing,
  typography,
  borderRadius,
  StatusBadge,
  ConfirmationModal,
} from '@mettig/shared';
import type { BookingItemDto } from '@mettig/shared';
import type { BookingsStackScreenProps } from '../../navigation/types';

type Props = BookingsStackScreenProps<'BookingDetails'>;

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  value: {
    ...typography.body,
    color: colors.text,
    flex: 2,
    textAlign: 'right',
  },
});

export function BookingDetailsScreen({ navigation, route }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params;

  const [booking, setBooking] = useState<BookingItemDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchBooking = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      // Reuse existing /bookings/my and find by id, or fetch directly
      const res = await apiClient.get<{ bookings: BookingItemDto[] }>('/bookings/my');
      const found = res.data.bookings.find((b) => b.id === bookingId) ?? null;
      setBooking(found);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void fetchBooking();
  }, [fetchBooking]);

  const handleCancel = useCallback(async () => {
    if (!booking) return;
    setShowCancelModal(false);
    setIsCancelling(true);
    try {
      await apiClient.delete(`/bookings/${bookingId}`);
      setBooking((prev) =>
        prev ? { ...prev, status: 'cancelled' as const, cancelled_at: new Date().toISOString() } : prev,
      );
    } catch {
      void fetchBooking();
    } finally {
      setIsCancelling(false);
    }
  }, [booking, bookingId, fetchBooking]);

  const statusLabel: Record<BookingItemDto['status'], string> = {
    confirmed: 'Подтверждена',
    cancelled: 'Отменена',
    completed: 'Завершена',
    no_show: 'Не явился',
  };

  // ── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Назад">
            <Text style={styles.back}>‹ Назад</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Запись</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Назад">
            <Text style={styles.back}>‹ Назад</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Запись</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Не удалось загрузить запись</Text>
          <TouchableOpacity onPress={() => void fetchBooking()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Назад">
          <Text style={styles.back}>‹ Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Запись</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {/* Status banner */}
        <View style={styles.statusRow}>
          <StatusBadge status={booking.status} />
          <Text style={styles.statusLabel}>{statusLabel[booking.status]}</Text>
        </View>

        {/* Business name */}
        <Text style={styles.businessName}>{booking.business_name}</Text>

        {/* Details card */}
        <View style={styles.card}>
          <InfoRow label="Услуга" value={booking.service_name} />
          <InfoRow label="Мастер" value={booking.staff_name} />
          <InfoRow label="Дата" value={booking.slot_date} />
          <InfoRow label="Время" value={booking.slot_start_time} />
          <InfoRow label="Стоимость" value={`${booking.service_price} ₽`} />
          {booking.cancelled_at && (
            <InfoRow
              label="Отменена"
              value={new Date(booking.cancelled_at).toLocaleDateString('ru-RU')}
            />
          )}
        </View>

        {/* Cancel button for confirmed bookings */}
        {booking.status === 'confirmed' && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => setShowCancelModal(true)}
            activeOpacity={0.7}
            accessibilityLabel="Отменить запись"
            disabled={isCancelling}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Text style={styles.cancelBtnText}>Отменить запись</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <ConfirmationModal
        visible={showCancelModal}
        title="Отменить запись?"
        message={`Вы уверены, что хотите отменить запись в ${booking.business_name}?`}
        confirmLabel="Да, отменить"
        cancelLabel="Нет, оставить"
        onConfirm={() => void handleCancel()}
        onCancel={() => setShowCancelModal(false)}
        isLoading={isCancelling}
        destructive
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  back: {
    ...typography.body,
    color: colors.accent,
    fontSize: 18,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  headerSpacer: {
    width: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.textMuted,
  },
  retryBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  retryText: {
    ...typography.buttonSmall,
    color: colors.accent,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  businessName: {
    ...typography.h2,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  cancelBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
  },
  cancelBtnText: {
    ...typography.button,
    color: colors.error,
  },
});
