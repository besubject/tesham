import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  apiClient,
  BookingCard,
  borderRadius,
  colors,
  ConfirmationModal,
  spacing,
  typography,
  WarningBanner,
} from '@mettig/shared';
import type { BookingItemDto } from '@mettig/shared';
import type { BookingsStackScreenProps } from '../../navigation/types';

type Props = BookingsStackScreenProps<'BookingsList'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isUpcoming(booking: BookingItemDto): boolean {
  return booking.status === 'confirmed';
}

function isPast(booking: BookingItemDto): boolean {
  return (
    booking.status === 'completed' ||
    booking.status === 'cancelled' ||
    booking.status === 'no_show'
  );
}

function isWithinCancellationThreshold(booking: BookingItemDto): boolean {
  const dateParts = booking.slot_date.split('-').map(Number);
  const timeParts = booking.slot_start_time.split(':').map(Number);
  const slotDateTime = new Date(
    dateParts[0] ?? 0,
    (dateParts[1] ?? 1) - 1,
    dateParts[2] ?? 1,
    timeParts[0] ?? 0,
    timeParts[1] ?? 0,
  );
  const diffMinutes = (slotDateTime.getTime() - Date.now()) / (1000 * 60);
  return diffMinutes >= 0 && diffMinutes < booking.cancellation_threshold_minutes;
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }): React.JSX.Element {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.badge}>
        <Text style={sectionStyles.badgeText}>{count}</Text>
      </View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  badge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState(): React.JSX.Element {
  return (
    <View style={emptyStyles.container}>
      <Text style={emptyStyles.icon}>📅</Text>
      <Text style={emptyStyles.title}>Нет записей</Text>
      <Text style={emptyStyles.subtitle}>
        Ваши будущие и прошлые записи будут отображаться здесь
      </Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
    gap: spacing.md,
  },
  icon: {
    fontSize: 48,
    lineHeight: 56,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});

// ─── BookingsScreen ───────────────────────────────────────────────────────────

type Section = {
  title: string;
  data: BookingItemDto[];
};

export function BookingsScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const [bookings, setBookings] = useState<BookingItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const cancelTarget =
    cancelTargetId != null ? (bookings.find((b) => b.id === cancelTargetId) ?? null) : null;
  const isLateCancellation = cancelTarget != null && isWithinCancellationThreshold(cancelTarget);

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchBookings = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const res = await apiClient.get<{ bookings: BookingItemDto[] }>('/bookings/my');
      setBookings(res.data.bookings);
    } catch {
      // keep existing state on error
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCancelPress = useCallback((bookingId: string) => {
    setCancelTargetId(bookingId);
  }, []);

  const handleCancelDismiss = useCallback(() => {
    setCancelTargetId(null);
  }, []);

  const handleCancelConfirm = useCallback(async () => {
    if (cancelTargetId == null) return;
    const id = cancelTargetId;
    setCancelTargetId(null);
    setIsCancelling(true);
    try {
      await apiClient.delete(`/bookings/${id}`);
      setBookings((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, status: 'cancelled' as const, cancelled_at: new Date().toISOString() }
            : b,
        ),
      );
    } catch {
      // re-fetch to sync state on failure
      void fetchBookings();
    } finally {
      setIsCancelling(false);
    }
  }, [cancelTargetId, fetchBookings]);

  const handleBookAgain = useCallback(
    (businessId: string) => {
      navigation.navigate('Home', {
        screen: 'BusinessDetails',
        params: { businessId },
      });
    },
    [navigation],
  );

  // ── Build sections ────────────────────────────────────────────────────────

  const upcoming = bookings.filter(isUpcoming);
  const past = bookings.filter(isPast);

  const sections: Section[] = [];
  if (upcoming.length > 0) {
    sections.push({ title: 'Текущие', data: upcoming });
  }
  if (past.length > 0) {
    sections.push({ title: 'Прошлые', data: past });
  }

  // ── Cancel modal message ──────────────────────────────────────────────────

  const cancelMessage = isLateCancellation
    ? `Вы отменяете запись менее чем за ${cancelTarget?.cancellation_threshold_minutes ?? 60} минут до визита. Отмена в последний момент может быть неудобна для мастера.`
    : `Вы уверены, что хотите отменить запись в ${cancelTarget?.business_name ?? ''}?`;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Мои записи</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Мои записи</Text>
        {isCancelling && <ActivityIndicator size="small" color={colors.accent} />}
      </View>

      {/* Content */}
      {sections.length === 0 ? (
        <EmptyState />
      ) : (
        <SectionList<BookingItemDto, Section>
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void fetchBookings(true)}
              tintColor={colors.accent}
            />
          }
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} count={section.data.length} />
          )}
          renderItem={({ item, section }) => {
            const isPastSection = section.title === 'Прошлые';
            const showWarning =
              item.status === 'confirmed' && isWithinCancellationThreshold(item);

            return (
              <View style={styles.cardWrapper}>
                {/* Late-cancellation warning shown above the card */}
                {showWarning && (
                  <WarningBanner
                    variant="warning"
                    message={`Поздняя отмена — менее ${item.cancellation_threshold_minutes} мин. до визита`}
                  />
                )}

                <BookingCard
                  booking={item}
                  onCancel={
                    item.status === 'confirmed'
                      ? () => handleCancelPress(item.id)
                      : undefined
                  }
                />

                {/* "Записаться снова" for past bookings */}
                {isPastSection && (
                  <TouchableOpacity
                    style={styles.bookAgainBtn}
                    onPress={() => handleBookAgain(item.business_id)}
                    activeOpacity={0.7}
                    accessibilityLabel={`Записаться снова в ${item.business_name}`}
                  >
                    <Text style={styles.bookAgainText}>Записаться снова</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Cancel confirmation modal (with late-cancellation warning in message) */}
      <ConfirmationModal
        visible={cancelTargetId != null}
        title="Отменить запись?"
        message={cancelMessage}
        confirmLabel="Да, отменить"
        cancelLabel="Нет, оставить"
        onConfirm={() => void handleCancelConfirm()}
        onCancel={handleCancelDismiss}
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
  screenTitle: {
    ...typography.h2,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    flexGrow: 1,
  },
  cardWrapper: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  bookAgainBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  bookAgainText: {
    ...typography.buttonSmall,
    color: colors.accent,
  },
});
