import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { apiClient, trackEvent } from '@mettig/shared';
import type { BusinessBookingItemDto, BookingStatus, ServiceItemDto, StaffItemDto, ChatUnreadCountDto } from '@mettig/shared';
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

function currentHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
  unreadCount: number;
  onPress: () => void;
  onOpenChat: () => void;
}

function BookingCard({ booking, isAdmin, unreadCount, onPress, onOpenChat }: BookingCardProps): React.JSX.Element {
  const color = STATUS_COLORS[booking.status];
  const isWalkIn = booking.source === 'walk_in';
  const isLink = booking.source === 'link';
  const hasChat = booking.status === 'confirmed' && booking.source === 'app';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTime}>{formatTime(booking.slot_start_time)}</Text>
          <Text style={styles.cardClient} numberOfLines={1}>
            {booking.client_name ?? 'Клиент'}
          </Text>
          {isWalkIn && (
            <View style={styles.walkInBadge}>
              <Text style={styles.walkInBadgeText}>Walk-in</Text>
            </View>
          )}
          {isLink && (
            <View style={styles.linkBadge}>
              <Text style={styles.linkBadgeText}>Ссылка</Text>
            </View>
          )}
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
        {hasChat && (
          <View style={styles.cardChatRow}>
            <TouchableOpacity
              style={styles.chatBtn}
              onPress={(e) => {
                e.stopPropagation();
                onOpenChat();
              }}
              activeOpacity={0.7}
              accessibilityLabel="Открыть чат"
            >
              <Text style={styles.chatBtnText}>💬 Чат</Text>
              {unreadCount > 0 && (
                <View style={styles.chatBadge}>
                  <Text style={styles.chatBadgeText}>
                    {unreadCount > 99 ? '99+' : String(unreadCount)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── WalkInModal ──────────────────────────────────────────────────────────────

interface WalkInModalProps {
  visible: boolean;
  isAdmin: boolean;
  staff: StaffItemDto[];
  currentStaffId: string | null;
  onClose: () => void;
  onCreated: () => void;
}

function WalkInModal({
  visible,
  isAdmin,
  staff,
  currentStaffId,
  onClose,
  onCreated,
}: WalkInModalProps): React.JSX.Element {
  const [services, setServices] = useState<ServiceItemDto[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [useNow, setUseNow] = useState(true);
  const [customTime, setCustomTime] = useState(currentHHMM());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load services when modal opens
  useEffect(() => {
    if (!visible) return;
    void (async () => {
      try {
        const { data } = await apiClient.get<{ services: ServiceItemDto[] }>('/business/services');
        setServices(data.services);
        setSelectedServiceId((prev) => (prev || (data.services[0]?.id ?? '')));
      } catch {
        // non-critical
      }
    })();
  }, [visible]);

  // Pre-fill staff when staff list arrives
  useEffect(() => {
    if (!isAdmin && currentStaffId) {
      setSelectedStaffId(currentStaffId);
      return;
    }

    if (staff.length > 0 && !selectedStaffId) {
      setSelectedStaffId(staff[0]?.id ?? '');
    }
  }, [currentStaffId, isAdmin, staff, selectedStaffId]);

  const reset = useCallback(() => {
    setSelectedServiceId(services.length > 0 ? (services[0]?.id ?? '') : '');
    setClientName('');
    setClientPhone('');
    setUseNow(true);
    setCustomTime(currentHHMM());
    setError(null);
  }, [services]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!selectedServiceId) {
      setError('Выберите услугу');
      return;
    }
    if (!selectedStaffId) {
      setError('Выберите мастера');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiClient.post('/business/bookings/walk-in', {
        staff_id: selectedStaffId,
        service_id: selectedServiceId,
        client_name: clientName.trim() || undefined,
        client_phone: clientPhone.trim() || undefined,
        time: useNow ? undefined : customTime,
      });
      await trackEvent({ event_type: 'walk_in_booking_created', payload: { has_phone: Boolean(clientPhone.trim()) } });
      Alert.alert('Готово', 'Клиент добавлен');
      reset();
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Не удалось добавить клиента');
    } finally {
      setLoading(false);
    }
  }, [selectedServiceId, selectedStaffId, clientName, clientPhone, useNow, customTime, reset, onCreated, onClose]);

  const handleOpen = useCallback(() => {
    void trackEvent({ event_type: 'walk_in_form_opened' });
  }, []);

  useEffect(() => {
    if (visible) handleOpen();
  }, [visible, handleOpen]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={modalStyles.overlay}>
          <TouchableWithoutFeedback>
            <View style={modalStyles.sheet}>
              {/* Handle */}
              <View style={modalStyles.handle} />

              <Text style={modalStyles.title}>Оффлайн-клиент</Text>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Staff picker (admin: dropdown, employee: read-only) */}
                <Text style={modalStyles.label}>Мастер</Text>
                {isAdmin ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={modalStyles.chipScroll}
                    contentContainerStyle={modalStyles.chipContent}
                  >
                    {staff.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[modalStyles.chip, selectedStaffId === s.id && modalStyles.chipActive]}
                        onPress={() => setSelectedStaffId(s.id)}
                      >
                        <Text style={[modalStyles.chipText, selectedStaffId === s.id && modalStyles.chipTextActive]}>
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={modalStyles.readOnlyField}>
                    <Text style={modalStyles.readOnlyText}>
                      {staff.find((s) => s.id === selectedStaffId)?.name ?? 'Текущий мастер'}
                    </Text>
                  </View>
                )}

                {/* Service picker */}
                <Text style={modalStyles.label}>Услуга *</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={modalStyles.chipScroll}
                  contentContainerStyle={modalStyles.chipContent}
                >
                  {services.map((sv) => (
                    <TouchableOpacity
                      key={sv.id}
                      style={[modalStyles.chip, selectedServiceId === sv.id && modalStyles.chipActive]}
                      onPress={() => setSelectedServiceId(sv.id)}
                    >
                      <Text style={[modalStyles.chipText, selectedServiceId === sv.id && modalStyles.chipTextActive]}>
                        {sv.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Client name */}
                <Text style={modalStyles.label}>Имя клиента (необязательно)</Text>
                <TextInput
                  style={modalStyles.input}
                  placeholder="Клиент"
                  placeholderTextColor="#8A8A86"
                  value={clientName}
                  onChangeText={setClientName}
                  returnKeyType="next"
                />

                {/* Client phone */}
                <Text style={modalStyles.label}>Телефон (необязательно)</Text>
                <TextInput
                  style={modalStyles.input}
                  placeholder="+7 (___) ___-__-__"
                  placeholderTextColor="#8A8A86"
                  value={clientPhone}
                  onChangeText={setClientPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                />

                {/* Time toggle */}
                <Text style={modalStyles.label}>Время</Text>
                <View style={modalStyles.timeRow}>
                  <TouchableOpacity
                    style={[modalStyles.timeChip, useNow && modalStyles.chipActive]}
                    onPress={() => setUseNow(true)}
                  >
                    <Text style={[modalStyles.chipText, useNow && modalStyles.chipTextActive]}>Сейчас</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[modalStyles.timeChip, !useNow && modalStyles.chipActive]}
                    onPress={() => setUseNow(false)}
                  >
                    <Text style={[modalStyles.chipText, !useNow && modalStyles.chipTextActive]}>Другое время</Text>
                  </TouchableOpacity>
                </View>
                {!useNow && (
                  <TextInput
                    style={modalStyles.input}
                    placeholder="ЧЧ:ММ"
                    placeholderTextColor="#8A8A86"
                    value={customTime}
                    onChangeText={setCustomTime}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                )}

                {error && <Text style={modalStyles.error}>{error}</Text>}

                {/* Buttons */}
                <View style={modalStyles.buttons}>
                  <TouchableOpacity style={modalStyles.cancelBtn} onPress={handleClose}>
                    <Text style={modalStyles.cancelBtnText}>Отмена</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[modalStyles.addBtn, loading && modalStyles.addBtnDisabled]}
                    onPress={() => void handleSubmit()}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={modalStyles.addBtnText}>Добавить</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── BookingsScreen ───────────────────────────────────────────────────────────

export function BookingsScreen({ navigation }: Props): React.JSX.Element {
  const today = useRef(new Date()).current;
  const dates = useRef(generateDateRange(today, 7, 13)).current;

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null); // null = "Все"
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffItemDto[]>([]);
  const [bookings, setBookings] = useState<BusinessBookingItemDto[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walkInVisible, setWalkInVisible] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

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

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await apiClient.get<{ staff: StaffItemDto }>('/business/staff/me');
        setCurrentStaffId(data.staff.id);
      } catch {
        // non-critical
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
    } catch (err: unknown) {
      const msg = (
        err as { response?: { data?: { error?: { message?: string }; message?: string } } }
      )?.response?.data?.error?.message
        ?? (
          err as { response?: { data?: { error?: { message?: string }; message?: string } } }
        )?.response?.data?.message
        ?? 'Не удалось загрузить записи';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedStaffId]);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  // Fetch unread counts for confirmed bookings
  useEffect(() => {
    const confirmed = bookings.filter((b) => b.status === 'confirmed' && b.source === 'app');
    if (confirmed.length === 0) return;

    void (async () => {
      const results = await Promise.allSettled(
        confirmed.map((b) =>
          apiClient
            .get<ChatUnreadCountDto>(`/bookings/${b.id}/messages/unread-count`)
            .then((r) => ({ id: b.id, count: r.data.unread_count })),
        ),
      );
      const counts: Record<string, number> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') {
          counts[r.value.id] = r.value.count;
        }
      }
      setUnreadCounts(counts);
    })();
  }, [bookings]);

  const handleCreateSlots = useCallback(() => {
    navigation.navigate('CreateSlots', {
      staffId: isAdmin ? (selectedStaffId ?? undefined) : (currentStaffId ?? undefined),
    });
  }, [currentStaffId, isAdmin, navigation, selectedStaffId]);

  const handleBookingPress = useCallback(
    (bookingId: string) => {
      navigation.navigate('BookingDetails', { bookingId });
    },
    [navigation],
  );

  const handleOpenChat = useCallback(
    (booking: BusinessBookingItemDto) => {
      const isReadOnly = booking.status !== 'confirmed';
      navigation.navigate('Chat', {
        bookingId: booking.id,
        clientName: booking.client_name ?? 'Клиент',
        isReadOnly,
      });
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
          <Text style={styles.addButtonText}>+ Слоты</Text>
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
              unreadCount={unreadCounts[item.id] ?? 0}
              onPress={() => handleBookingPress(item.id)}
              onOpenChat={() => handleOpenChat(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB — Walk-in */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setWalkInVisible(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+ Клиент</Text>
      </TouchableOpacity>

      {/* Walk-in Modal */}
      <WalkInModal
        visible={walkInVisible}
        isAdmin={isAdmin}
        staff={staff}
        currentStaffId={currentStaffId}
        onClose={() => setWalkInVisible(false)}
        onCreated={() => void fetchBookings()}
      />
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
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: '#1D6B4F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
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
    paddingBottom: 96,
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
  walkInBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  walkInBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },
  linkBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  linkBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1D4ED8',
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
  cardChatRow: {
    marginTop: 6,
    flexDirection: 'row',
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4EF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
  },
  chatBtnText: {
    fontSize: 12,
    color: '#1D6B4F',
    fontWeight: '600',
  },
  chatBadge: {
    backgroundColor: '#C4462A',
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chatBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
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
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#1D6B4F',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E8E8E4',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A18',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C5C58',
    marginBottom: 8,
    marginTop: 12,
  },
  chipScroll: {
    maxHeight: 44,
  },
  chipContent: {
    gap: 8,
    alignItems: 'center',
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F5F5F2',
    borderWidth: 1,
    borderColor: '#E8E8E4',
  },
  chipActive: {
    backgroundColor: '#1D6B4F',
    borderColor: '#1D6B4F',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5C5C58',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  readOnlyField: {
    backgroundColor: '#F5F5F2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E8E8E4',
  },
  readOnlyText: {
    fontSize: 14,
    color: '#1A1A18',
  },
  input: {
    backgroundColor: '#F9F9F7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1A1A18',
    borderWidth: 1,
    borderColor: '#E8E8E4',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F5F5F2',
    borderWidth: 1,
    borderColor: '#E8E8E4',
  },
  error: {
    fontSize: 13,
    color: '#C4462A',
    marginTop: 12,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F5F5F2',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5C5C58',
  },
  addBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1D6B4F',
    alignItems: 'center',
  },
  addBtnDisabled: {
    opacity: 0.6,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
