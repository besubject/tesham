import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '@mettig/shared';
import type { BusinessBookingItemDto, BookingStatus } from '@mettig/shared';
import type { BookingsStackScreenProps } from '../../navigation/types';

type Props = BookingsStackScreenProps<'BookingDetails'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<BookingStatus, string> = {
  confirmed: '#1D6B4F',
  completed: '#2563EB',
  cancelled: '#8A8A86',
  no_show: '#D97706',
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed: 'Подтверждена',
  completed: 'Выполнена',
  cancelled: 'Отменена',
  no_show: 'Не пришёл',
};

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function formatPrice(price: number): string {
  return `${price.toLocaleString('ru-RU')} ₽`;
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── BookingDetailsScreen ─────────────────────────────────────────────────────

export function BookingDetailsScreen({ route, navigation }: Props): React.JSX.Element {
  const { bookingId } = route.params;

  const [booking, setBooking] = useState<BusinessBookingItemDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchBooking = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch via single-booking lookup: use the list endpoint filtered by booking id
      // Backend doesn't have a GET /business/bookings/:id — use the list and find it
      const { data } = await apiClient.get<{ bookings: BusinessBookingItemDto[] }>(
        '/business/bookings',
      );
      const found = data.bookings.find((b) => b.id === bookingId) ?? null;
      if (!found) {
        setError('Запись не найдена');
      } else {
        setBooking(found);
      }
    } catch {
      setError('Не удалось загрузить запись');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void fetchBooking();
  }, [fetchBooking]);

  const updateStatus = useCallback(
    async (status: BookingStatus) => {
      const labels: Record<BookingStatus, string> = {
        confirmed: 'подтвердить',
        completed: 'отметить как выполненную',
        cancelled: 'отменить',
        no_show: 'отметить как неявку',
      };
      Alert.alert(
        'Подтвердите действие',
        `Вы хотите ${labels[status]} эту запись?`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Да',
            style: status === 'cancelled' ? 'destructive' : 'default',
            onPress: async () => {
              setUpdating(true);
              try {
                const { data } = await apiClient.patch<{ booking: BusinessBookingItemDto }>(
                  `/business/bookings/${bookingId}`,
                  { status },
                );
                setBooking(data.booking);
              } catch {
                Alert.alert('Ошибка', 'Не удалось изменить статус записи');
              } finally {
                setUpdating(false);
              }
            },
          },
        ],
      );
    },
    [bookingId],
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Детали записи</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1D6B4F" />
        </View>
      ) : error || !booking ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Запись не найдена'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void fetchBooking()}>
            <Text style={styles.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Status badge */}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${STATUS_COLORS[booking.status]}1A` },
            ]}
          >
            <View
              style={[styles.statusDot, { backgroundColor: STATUS_COLORS[booking.status] }]}
            />
            <Text style={[styles.statusText, { color: STATUS_COLORS[booking.status] }]}>
              {STATUS_LABELS[booking.status]}
            </Text>
          </View>

          {/* Main info */}
          <View style={styles.card}>
            <InfoRow label="Дата" value={formatDate(booking.slot_date)} />
            <View style={styles.divider} />
            <InfoRow label="Время" value={formatTime(booking.slot_start_time)} />
            <View style={styles.divider} />
            <InfoRow label="Услуга" value={booking.service_name} />
            <View style={styles.divider} />
            <InfoRow label="Стоимость" value={formatPrice(booking.service_price)} />
          </View>

          {/* Client info */}
          <Text style={styles.sectionTitle}>Клиент</Text>
          <View style={styles.card}>
            <InfoRow label="Имя" value={booking.client_name ?? 'Клиент'} />
            <View style={styles.divider} />
            <InfoRow label="Телефон" value={booking.client_phone ?? '—'} />
          </View>

          {/* Staff */}
          <Text style={styles.sectionTitle}>Мастер</Text>
          <View style={styles.card}>
            <InfoRow label="Имя" value={booking.staff_name} />
          </View>

          {/* Chat button — for confirmed bookings */}
          {booking.status === 'confirmed' && (
            <>
              <Text style={styles.sectionTitle}>Чат</Text>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionChat]}
                onPress={() =>
                  navigation.navigate('Chat', {
                    bookingId,
                    clientName: booking.client_name ?? 'Клиент',
                    isReadOnly: false,
                  })
                }
              >
                <Text style={styles.actionButtonText}>💬 Открыть чат с клиентом</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Action buttons — only for confirmed bookings */}
          {booking.status === 'confirmed' && (
            <>
              <Text style={styles.sectionTitle}>Действия</Text>
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionCompleted]}
                  onPress={() => void updateStatus('completed')}
                  disabled={updating}
                >
                  <Text style={styles.actionButtonText}>✓ Выполнено</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionNoShow]}
                  onPress={() => void updateStatus('no_show')}
                  disabled={updating}
                >
                  <Text style={[styles.actionButtonText, { color: '#D97706' }]}>Не пришёл</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionCancel]}
                  onPress={() => void updateStatus('cancelled')}
                  disabled={updating}
                >
                  <Text style={[styles.actionButtonText, { color: '#C4462A' }]}>
                    Отменить запись
                  </Text>
                </TouchableOpacity>
              </View>
              {updating && (
                <ActivityIndicator
                  size="small"
                  color="#1D6B4F"
                  style={{ marginTop: 12 }}
                />
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 22,
    color: '#1D6B4F',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A18',
  },
  headerRight: {
    width: 32,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 16,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    marginBottom: 16,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#8A8A86',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A18',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E8E8E4',
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8A8A86',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  actionsContainer: {
    gap: 8,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionChat: {
    backgroundColor: '#E8F4EF',
    borderColor: '#1D6B4F',
    marginBottom: 8,
  },
  actionCompleted: {
    backgroundColor: '#E8F4EF',
    borderColor: '#1D6B4F',
  },
  actionNoShow: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  actionCancel: {
    backgroundColor: '#FEF2F2',
    borderColor: '#C4462A',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1D6B4F',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 15,
    color: '#C4462A',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1D6B4F',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
