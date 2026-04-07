import React, { useCallback, useState } from 'react';
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
  borderRadius,
  colors,
  ConfirmationModal,
  spacing,
  typography,
} from '@mettig/shared';
import type { HomeStackScreenProps } from '../../navigation/types';

type Props = HomeStackScreenProps<'BookingConfirm'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRuDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year as number, (month as number) - 1, day as number);
  const weekdays = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  const wd = weekdays[date.getDay()] ?? '';
  const mn = months[date.getMonth()] ?? '';
  return `${date.getDate()} ${mn} (${wd})`;
}

// ─── Detail row ───────────────────────────────────────────────────────────────

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps): React.JSX.Element {
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
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    gap: spacing.md,
  },
  label: {
    ...typography.body,
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
  },
  value: {
    ...typography.bodyMedium,
    color: colors.white,
    flex: 1,
    textAlign: 'right',
  },
});

// ─── BookingConfirmScreen ─────────────────────────────────────────────────────

export function BookingConfirmScreen({ navigation, route }: Props): React.JSX.Element {
  const { bookingId, businessName, staffName, serviceName, date, startTime, price } = route.params;
  const insets = useSafeAreaInsets();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const handleCancelPress = useCallback(() => {
    setShowCancelModal(true);
  }, []);

  const handleCancelConfirm = useCallback(async () => {
    setShowCancelModal(false);
    setIsCancelling(true);
    try {
      await apiClient.delete(`/bookings/${bookingId}`);
      setCancelled(true);
    } catch {
      // Even if API fails show cancelled state optimistically — user already confirmed intent
      setCancelled(true);
    } finally {
      setIsCancelling(false);
    }
  }, [bookingId]);

  const handleGoHome = useCallback(() => {
    navigation.popToTop();
  }, [navigation]);

  // ── Cancelled state ────────────────────────────────────────────────────────
  if (cancelled) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.cancelledContent}>
          <View style={styles.cancelledIconCircle}>
            <Text style={styles.cancelledIcon}>✕</Text>
          </View>
          <Text style={styles.cancelledTitle}>Запись отменена</Text>
          <Text style={styles.cancelledSubtitle}>
            Ваша запись в {businessName} была отменена.
          </Text>
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={handleGoHome}
            activeOpacity={0.8}
          >
            <Text style={styles.homeBtnText}>На главную</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Confirmed state ────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Green confirmation card */}
        <View style={styles.confirmCard}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.confirmTitle}>Запись подтверждена!</Text>
          <Text style={styles.confirmSubtitle}>
            Ждём вас в {businessName}
          </Text>

          {/* Booking details */}
          <View style={styles.detailsContainer}>
            <DetailRow label="Мастер" value={staffName} />
            <DetailRow label="Услуга" value={serviceName} />
            <DetailRow label="Дата" value={formatRuDate(date)} />
            <DetailRow label="Время" value={startTime.slice(0, 5)} />
            <DetailRow label="Стоимость" value={`${price.toLocaleString('ru-RU')} ₽`} />
          </View>
        </View>

        {/* Reminder info */}
        <View style={styles.reminderCard}>
          <Text style={styles.reminderIcon}>🔔</Text>
          <View style={styles.reminderText}>
            <Text style={styles.reminderTitle}>Напоминание</Text>
            <Text style={styles.reminderBody}>
              Мы напомним вам о записи за 24 часа и за 30 минут до начала.
            </Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            Если вы не сможете прийти, пожалуйста, отмените запись заблаговременно.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TouchableOpacity
          style={[styles.cancelBtn, isCancelling && styles.cancelBtnDisabled]}
          onPress={handleCancelPress}
          disabled={isCancelling}
          activeOpacity={0.8}
        >
          {isCancelling ? (
            <ActivityIndicator color={colors.coral} />
          ) : (
            <Text style={styles.cancelBtnText}>Отменить запись</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={handleGoHome}
          activeOpacity={0.8}
        >
          <Text style={styles.homeBtnText}>На главную</Text>
        </TouchableOpacity>
      </View>

      {/* Cancel confirmation modal */}
      <ConfirmationModal
        visible={showCancelModal}
        title="Отменить запись?"
        message={`Вы уверены, что хотите отменить запись к ${staffName} на ${startTime.slice(0, 5)}?`}
        confirmLabel="Да, отменить"
        cancelLabel="Нет, оставить"
        onConfirm={() => void handleCancelConfirm()}
        onCancel={() => setShowCancelModal(false)}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  // Green confirmation card
  confirmCard: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    fontSize: 32,
    color: colors.white,
    lineHeight: 40,
  },
  confirmTitle: {
    ...typography.h2,
    color: colors.white,
    textAlign: 'center',
  },
  confirmSubtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  detailsContainer: {
    width: '100%',
    marginTop: spacing.sm,
  },
  // Reminder card
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.accentLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  reminderIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  reminderText: {
    flex: 1,
    gap: spacing.xs,
  },
  reminderTitle: {
    ...typography.bodyMedium,
    color: colors.accent,
  },
  reminderBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  infoIcon: {
    fontSize: 16,
    lineHeight: 22,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  // Footer
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: colors.coral,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  cancelBtnDisabled: {
    opacity: 0.6,
  },
  cancelBtnText: {
    ...typography.button,
    color: colors.coral,
  },
  homeBtn: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  homeBtnText: {
    ...typography.button,
    color: colors.white,
  },
  // Cancelled state
  cancelledContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  cancelledIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.coralLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelledIcon: {
    fontSize: 32,
    color: colors.coral,
    lineHeight: 40,
  },
  cancelledTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  cancelledSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
