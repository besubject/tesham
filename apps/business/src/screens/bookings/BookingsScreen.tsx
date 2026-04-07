import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient, useAuthStore } from '@mettig/shared';
import type { BusinessBookingItemDto, BookingStatus, StaffItemDto } from '@mettig/shared';
import type { BookingsStackScreenProps } from '../../navigation/types';
import { tokenStorage } from '@mettig/shared';

type Props = BookingsStackScreenProps<'BookingsList'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function formatPrice(price: number): string {
  return `${price.toLocaleString('ru-RU')} ₽`;
}

const DAY_NAMES_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function generateDateRange(center: Date, before: number, after: number): Date[] {
  const dates: Date[] = [];
  for (let i = -before; i <= after; i++) {
    const d = new Date(center);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function decodeJwtRole(token: string): 'admin' | 'employee' | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as { role?: string };
    if (payload.role === 'admin' || payload.role === 'employee') {
      return payload.role;
    }
    return null;
  } catch {
    return null;
  }
}

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

// ─── BookingCard ──────────────────────────────────────────────────────────────

interface BookingCardProps {
  booking: BusinessBookingItemDto;
  isAdmin: boolean;
  onPress: () => void;
}

function BookingCard({ booking, isAdmin, onPress }: BookingCardProps): React.JSX.Element {
  const color = STATUS_COLORS[booking.status];
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTime}>{formatTime(booking.slot_start_time)}</Text>
          <Text style={styles.cardClient} numberOfLines={1}>
            {booking.client_name}
          </Text>
          <Text style={styles.cardPrice}>{formatPrice(booking.service_price)}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardService} numberOfLines={1}>
            {booking.service_name}
          </Text>
          {isAdmin && (
            <Text style={styles.cardStaff} numberOfLines={1}>
              {booking.staff_name}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── BookingsScreen ───────────────────────────────────────────────────────────

export function BookingsScreen({ navigation }: Props): React.JSX.Element {
  const user = useAuthStore((s) => s.user);

  const today = useRef(new Date()).current;
  const dates = useRef(generateDateRange(today, 7, 13)).current;

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null); // null = "Все"
  const [staff, setStaff] = useState<StaffItemDto[]>([]);
  const [bookings, setBookings] = useState<BusinessBookingItemDto[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve role once on mount
  useEffect(() => {
    void (async () => {
      const token = await tokenStorage.getAccessToken();
      if (token) {
        const role = decodeJwtRole(token);
        setIsAdmin(role === 'admin');
      }
    })();
  }, []);

  // Fetch staff list
  useEffect(() => {
    void (async () => {
      try {
        const { data } = await apiClient.get<{ staff: StaffItemDto[] }>('/business/staff');
        setStaff(data.staff);
      } catch {
        // non-critical — proceed without staff list
      }
    })();
  }, []);

  // Fetch bookings when date or staff filter changes
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = formatDate(selectedDate);
      const params: Record<string, string> = { date: dateStr };
      if (selectedStaffId) params['staff_id'] = selectedStaffId;

      const { data } = await apiClient.get<{ bookings: BusinessBookingItemDto[] }>(
        '/business/bookings',
        { params },
      );
      setBookings(data.bookings);
    } catch {
      setError('Не удалось загрузить записи');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedStaffId]);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  const handleCreateSlots = useCallback(() => {
    navigation.navigate('CreateSlots', undefined);
  }, [navigation]);

  const handleBookingPress = useCallback(
    (bookingId: string) => {
      navigation.navigate('BookingDetails', { bookingId });
    },
    [navigation],
  );

  const isSameDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Записи</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleCreateSlots}>
          <Text style={styles.addButtonText}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* Staff segmented control (admin only) */}
      {isAdmin && staff.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.segmentScroll}
          contentContainerStyle={styles.segmentContent}
        >
          <TouchableOpacity
            style={[styles.segmentChip, selectedStaffId === null && styles.segmentChipActive]}
            onPress={() => setSelectedStaffId(null)}
          >
            <Text
              style={[
                styles.segmentChipText,
                selectedStaffId === null && styles.segmentChipTextActive,
              ]}
            >
              Все
            </Text>
          </TouchableOpacity>
          {staff.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.segmentChip, selectedStaffId === s.id && styles.segmentChipActive]}
              onPress={() => setSelectedStaffId(s.id)}
            >
              <Text
                style={[
                  styles.segmentChipText,
                  selectedStaffId === s.id && styles.segmentChipTextActive,
                ]}
              >
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Date picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dateScroll}
        contentContainerStyle={styles.dateContent}
      >
        {dates.map((d) => {
          const isSelected = isSameDate(d, selectedDate);
          const isToday = isSameDate(d, today);
          return (
            <TouchableOpacity
              key={d.toISOString()}
              style={[styles.dateCell, isSelected && styles.dateCellActive]}
              onPress={() => setSelectedDate(d)}
            >
              <Text
                style={[styles.dateDayName, isSelected && styles.dateDayNameActive]}
              >
                {DAY_NAMES_SHORT[d.getDay()]}
              </Text>
              <Text style={[styles.dateDayNum, isSelected && styles.dateDayNumActive]}>
                {d.getDate()}
              </Text>
              {isToday && <View style={[styles.todayDot, isSelected && styles.todayDotActive]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Status legend */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.legendScroll}
        contentContainerStyle={styles.legendContent}
      >
        {(Object.entries(STATUS_COLORS) as [BookingStatus, string][]).map(([status, color]) => (
          <View key={status} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{STATUS_LABELS[status]}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Booking list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1D6B4F" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void fetchBookings()}>
            <Text style={styles.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Записей нет</Text>
          <Text style={styles.emptySubtitle}>
            {`На ${selectedDate.getDate()}.${String(selectedDate.getMonth() + 1).padStart(2, '0')} нет записей`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              isAdmin={isAdmin}
              onPress={() => handleBookingPress(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A18',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1D6B4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  // Segment control
  segmentScroll: {
    maxHeight: 44,
    marginBottom: 4,
  },
  segmentContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  segmentChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F5F5F2',
    borderWidth: 1,
    borderColor: '#E8E8E4',
  },
  segmentChipActive: {
    backgroundColor: '#1D6B4F',
    borderColor: '#1D6B4F',
  },
  segmentChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5C5C58',
  },
  segmentChipTextActive: {
    color: '#FFFFFF',
  },
  // Date picker
  dateScroll: {
    maxHeight: 72,
    marginVertical: 8,
  },
  dateContent: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  dateCell: {
    width: 44,
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E4',
  },
  dateCellActive: {
    backgroundColor: '#1D6B4F',
    borderColor: '#1D6B4F',
  },
  dateDayName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8A8A86',
    marginBottom: 2,
  },
  dateDayNameActive: {
    color: '#E8F4EF',
  },
  dateDayNum: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A18',
  },
  dateDayNumActive: {
    color: '#FFFFFF',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1D6B4F',
    marginTop: 2,
  },
  todayDotActive: {
    backgroundColor: '#FFFFFF',
  },
  // Legend
  legendScroll: {
    maxHeight: 28,
    marginBottom: 8,
  },
  legendContent: {
    paddingHorizontal: 16,
    gap: 16,
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
    color: '#5C5C58',
  },
  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTime: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A18',
    minWidth: 42,
  },
  cardClient: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A18',
  },
  cardPrice: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5C5C58',
  },
  cardService: {
    flex: 1,
    fontSize: 13,
    color: '#8A8A86',
    marginLeft: 48,
  },
  cardStaff: {
    fontSize: 12,
    color: '#8A8A86',
    fontStyle: 'italic',
  },
  // States
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A18',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8A8A86',
    textAlign: 'center',
  },
});
