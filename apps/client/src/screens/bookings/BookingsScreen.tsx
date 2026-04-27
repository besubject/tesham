import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
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
  ConfirmationModal,
  monoFont,
  spacing,
  WarningBanner,
} from '@mettig/shared';
import type { BookingItemDto, ChatUnreadCountDto } from '@mettig/shared';
import type { BookingsStackScreenProps } from '../../navigation/types';

type Props = BookingsStackScreenProps<'BookingsList'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'] as const;
const DAYS_SHORT = ['вс','пн','вт','ср','чт','пт','сб'] as const;

function fmtBookingDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y as number, (m as number) - 1, d as number);
  const day = DAYS_SHORT[dt.getDay()] ?? '';
  const mon = MONTHS_SHORT[dt.getMonth()] ?? '';
  return `${String(dt.getDate()).padStart(2, '0')} ${mon} · ${day}`;
}

function isUpcoming(b: BookingItemDto): boolean { return b.status === 'confirmed'; }
function isPast(b: BookingItemDto): boolean {
  return b.status === 'completed' || b.status === 'cancelled' || b.status === 'no_show';
}
function isWithinCancellationThreshold(b: BookingItemDto): boolean {
  const [y, mo, d] = b.slot_date.split('-').map(Number);
  const [hh, mm] = b.slot_start_time.split(':').map(Number);
  const dt = new Date(y ?? 0, (mo ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
  const diff = (dt.getTime() - Date.now()) / (1000 * 60);
  return diff >= 0 && diff < b.cancellation_threshold_minutes;
}

// ─── Dark hero card (nearest upcoming) ────────────────────────────────────────

function HeroCard({
  booking,
  onChat,
  onCancel,
  unread,
}: {
  booking: BookingItemDto;
  onChat: () => void;
  onCancel: () => void;
  unread: number;
}): React.JSX.Element {
  return (
    <View style={heroStyles.card}>
      <View style={heroStyles.topRow}>
        <Text style={heroStyles.label}>Сегодня · ближайшая</Text>
        {unread > 0 && (
          <View style={heroStyles.unreadBadge}>
            <Text style={heroStyles.unreadText}>{unread}</Text>
          </View>
        )}
      </View>

      <View style={heroStyles.body}>
        <View>
          <Text style={heroStyles.bigTime}>{booking.slot_start_time.slice(0, 5)}</Text>
          <Text style={heroStyles.businessName}>{booking.business_name}</Text>
          <Text style={heroStyles.detail}>{booking.service_name} · {booking.staff_name}</Text>
        </View>
        <View style={heroStyles.actions}>
          <TouchableOpacity style={heroStyles.actionBtn} onPress={onChat} activeOpacity={0.7}>
            <Text style={heroStyles.actionBtnText}>✉ Чат</Text>
          </TouchableOpacity>
          <TouchableOpacity style={heroStyles.actionBtn} onPress={onCancel} activeOpacity={0.7}>
            <Text style={heroStyles.actionBtnText}>✕ Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.text,
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 10,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  label: { fontFamily: monoFont, fontSize: 10, color: 'rgba(251,250,246,0.55)', letterSpacing: 0.6, textTransform: 'uppercase' },
  unreadBadge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { fontFamily: monoFont, fontSize: 10, color: '#fff', fontWeight: '700' },
  body: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  bigTime: { fontSize: 48, fontWeight: '700', letterSpacing: -2, lineHeight: 48, color: colors.surface },
  businessName: { fontSize: 13, color: 'rgba(251,250,246,0.7)', marginTop: 8 },
  detail: { fontSize: 12, color: 'rgba(251,250,246,0.55)', marginTop: 2 },
  actions: { gap: 6 },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  actionBtnText: { fontSize: 11, fontWeight: '500', color: colors.surface },
});

// ─── Compact booking card ─────────────────────────────────────────────────────

function BookingRow({
  booking,
  onChat,
  onCancel,
  onBookAgain,
  onLeaveReview,
  onReviews,
  unread,
  showWarning,
}: {
  booking: BookingItemDto;
  onChat?: () => void;
  onCancel?: () => void;
  onBookAgain?: () => void;
  onLeaveReview?: () => void;
  onReviews?: () => void;
  unread: number;
  showWarning: boolean;
}): React.JSX.Element {
  const statusColor = booking.status === 'confirmed'
    ? colors.ok
    : booking.status === 'cancelled' ? colors.coral : colors.textMuted;
  const statusLabel = booking.status === 'confirmed' ? 'подтверждено'
    : booking.status === 'completed' ? 'завершено'
    : booking.status === 'cancelled' ? 'отменено' : 'неявка';

  return (
    <View style={rowStyles.wrap}>
      {showWarning && (
        <WarningBanner
          variant="warning"
          message={`Поздняя отмена — менее ${booking.cancellation_threshold_minutes} мин. до визита`}
        />
      )}
      <View style={rowStyles.card}>
        <View style={rowStyles.mainRow}>
          <Text style={rowStyles.time}>{booking.slot_start_time.slice(0, 5)}</Text>
          <View style={rowStyles.info}>
            <Text style={rowStyles.name} numberOfLines={1}>{booking.business_name}</Text>
            <Text style={rowStyles.sub} numberOfLines={1}>{booking.service_name} · {fmtBookingDate(booking.slot_date)}</Text>
          </View>
          <Text style={[rowStyles.status, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        {/* Action buttons */}
        {(onChat != null || onCancel != null || onBookAgain != null || onLeaveReview != null) && (
          <View style={rowStyles.actionsRow}>
            {onChat != null && (
              <TouchableOpacity style={rowStyles.actBtn} onPress={onChat} activeOpacity={0.7}>
                <Text style={rowStyles.actBtnText}>
                  Чат{unread > 0 ? ` (${unread})` : ''}
                </Text>
              </TouchableOpacity>
            )}
            {onCancel != null && (
              <TouchableOpacity style={[rowStyles.actBtn, rowStyles.actBtnDanger]} onPress={onCancel} activeOpacity={0.7}>
                <Text style={[rowStyles.actBtnText, rowStyles.actBtnDangerText]}>Отмена</Text>
              </TouchableOpacity>
            )}
            {onBookAgain != null && (
              <TouchableOpacity style={rowStyles.actBtn} onPress={onBookAgain} activeOpacity={0.7}>
                <Text style={rowStyles.actBtnText}>Снова</Text>
              </TouchableOpacity>
            )}
            {onReviews != null && (
              <TouchableOpacity style={rowStyles.actBtn} onPress={onReviews} activeOpacity={0.7}>
                <Text style={rowStyles.actBtnText}>Отзывы</Text>
              </TouchableOpacity>
            )}
            {onLeaveReview != null && (
              <TouchableOpacity style={[rowStyles.actBtn, rowStyles.actBtnAccent]} onPress={onLeaveReview} activeOpacity={0.7}>
                <Text style={[rowStyles.actBtnText, rowStyles.actBtnAccentText]}>★ Отзыв</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  mainRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  time: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: colors.text, minWidth: 52 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 13, fontWeight: '600', color: colors.text },
  sub: { fontFamily: monoFont, fontSize: 10, color: colors.textMuted, letterSpacing: 0.3 },
  status: { fontFamily: monoFont, fontSize: 9, letterSpacing: 0.4, textTransform: 'uppercase' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  actBtnText: { fontSize: 11, fontWeight: '500', color: colors.textSecondary },
  actBtnDanger: { borderColor: colors.coral, backgroundColor: colors.coralLight },
  actBtnDangerText: { color: colors.coral },
  actBtnAccent: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  actBtnAccentText: { color: colors.accent },
});

// ─── BookingsScreen ───────────────────────────────────────────────────────────

export function BookingsScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const [bookings, setBookings] = useState<BookingItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const cancelTarget = cancelTargetId != null ? (bookings.find((b) => b.id === cancelTargetId) ?? null) : null;
  const isLateCancellation = cancelTarget != null && isWithinCancellationThreshold(cancelTarget);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchUnreadCounts = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const results = await Promise.allSettled(
      ids.map((id) => apiClient.get<ChatUnreadCountDto>(`/bookings/${id}/messages/unread-count`)),
    );
    const counts: Record<string, number> = {};
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') counts[ids[index] ?? ''] = result.value.data.unread_count;
    });
    setUnreadCounts(counts);
  }, []);

  const fetchBookings = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const res = await apiClient.get<{ bookings: BookingItemDto[] }>('/bookings/my');
      setBookings(res.data.bookings);
      const confirmedIds = res.data.bookings.filter((b) => b.status === 'confirmed').map((b) => b.id);
      void fetchUnreadCounts(confirmedIds);
    } catch { /* keep existing */ } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchUnreadCounts]);

  useEffect(() => { void fetchBookings(); }, [fetchBookings]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCancelConfirm = useCallback(async () => {
    if (cancelTargetId == null) return;
    const id = cancelTargetId;
    setCancelTargetId(null);
    setIsCancelling(true);
    try {
      await apiClient.delete(`/bookings/${id}`);
      setBookings((prev) => prev.map((b) =>
        b.id === id ? { ...b, status: 'cancelled' as const, cancelled_at: new Date().toISOString() } : b,
      ));
    } catch { void fetchBookings(); } finally { setIsCancelling(false); }
  }, [cancelTargetId, fetchBookings]);

  const handleOpenChat = useCallback(
    (booking: BookingItemDto) => {
      navigation.navigate('Chat', {
        bookingId: booking.id,
        businessName: booking.business_name,
        staffName: booking.staff_name,
        isReadOnly: booking.status !== 'confirmed',
      });
    },
    [navigation],
  );

  const handleBookAgain = useCallback(
    (businessId: string) => { navigation.navigate('Home', { screen: 'BusinessDetails', params: { businessId } }); },
    [navigation],
  );

  // ── Data ──────────────────────────────────────────────────────────────────
  const upcoming = bookings.filter(isUpcoming);
  const past = bookings.filter(isPast);
  const nearestUpcoming = upcoming[0];
  const restUpcoming = upcoming.slice(1);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Text style={styles.pageLabel}>Записи</Text>
          <Text style={styles.totalLabel}>{isCancelling ? '...' : ''}</Text>
        </View>
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.accent} /></View>
      </View>
    );
  }

  const cancelMessage = isLateCancellation
    ? `Отменяете запись менее чем за ${cancelTarget?.cancellation_threshold_minutes ?? 60} мин. до визита.`
    : `Отменить запись в ${cancelTarget?.business_name ?? ''}?`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <Text style={styles.pageLabel}>Записи</Text>
        <Text style={styles.totalLabel}>{bookings.length > 0 ? `${bookings.length} за всё время` : ''}</Text>
      </View>

      <Text style={styles.screenTitle}>Мои записи</Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void fetchBookings(true)} tintColor={colors.accent} />
        }
      >
        {/* Empty state */}
        {bookings.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Нет записей</Text>
            <Text style={styles.emptySub}>Ваши записи появятся здесь</Text>
          </View>
        )}

        {/* Hero card — nearest upcoming */}
        {nearestUpcoming != null && (
          <HeroCard
            booking={nearestUpcoming}
            unread={unreadCounts[nearestUpcoming.id] ?? 0}
            onChat={() => handleOpenChat(nearestUpcoming)}
            onCancel={() => setCancelTargetId(nearestUpcoming.id)}
          />
        )}

        {/* Rest upcoming */}
        {restUpcoming.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Предстоящие</Text>
            <View style={styles.group}>
              {restUpcoming.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  unread={unreadCounts[b.id] ?? 0}
                  showWarning={isWithinCancellationThreshold(b)}
                  onChat={() => handleOpenChat(b)}
                  onCancel={() => setCancelTargetId(b.id)}
                />
              ))}
            </View>
          </>
        )}

        {/* Past bookings */}
        {past.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Прошлые</Text>
            <View style={styles.group}>
              {past.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  unread={0}
                  showWarning={false}
                  onBookAgain={() => handleBookAgain(b.business_id)}
                  onReviews={() => navigation.navigate('ReviewsList', { businessId: b.business_id, businessName: b.business_name })}
                  onLeaveReview={b.status === 'completed'
                    ? () => navigation.navigate('LeaveReview', { bookingId: b.id, businessName: b.business_name })
                    : undefined}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <ConfirmationModal
        visible={cancelTargetId != null}
        title="Отменить запись?"
        message={cancelMessage}
        confirmLabel="Да, отменить"
        cancelLabel="Нет, оставить"
        onConfirm={() => void handleCancelConfirm()}
        onCancel={() => setCancelTargetId(null)}
        isLoading={isCancelling}
        destructive
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  pageLabel: { fontFamily: monoFont, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted },
  totalLabel: { fontFamily: monoFont, fontSize: 10, color: colors.textMuted, letterSpacing: 0.3 },
  screenTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8, color: colors.text, paddingHorizontal: 18, paddingBottom: 14 },
  scroll: { flex: 1 },
  scrollContent: { gap: 0 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingHorizontal: 18,
    paddingBottom: 8,
    paddingTop: 14,
  },
  group: { paddingHorizontal: 18, gap: spacing.sm },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: spacing.sm },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.text },
  emptySub: { fontSize: 13, color: colors.textMuted },
});
