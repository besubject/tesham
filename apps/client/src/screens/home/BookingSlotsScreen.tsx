import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  AvatarInitials,
  borderRadius,
  BusinessDetailDto,
  colors,
  ServiceItemDto,
  SlotChip,
  SlotItemDto,
  spacing,
  StaffItemDto,
  typography,
} from '@mettig/shared';
import type { HomeStackScreenProps } from '../../navigation/types';

type Props = HomeStackScreenProps<'BookingSlots'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generateCalendarDays(count: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year as number, (month as number) - 1, day as number);
  const weekdays = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  const wd = weekdays[date.getDay()] ?? '';
  const mn = months[date.getMonth()] ?? '';
  return `${date.getDate()} ${mn}, ${wd}`;
}

const DAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const;
const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StaffOptionProps {
  staff: StaffItemDto;
  selected: boolean;
  onSelect: () => void;
}

function StaffOption({ staff, selected, onSelect }: StaffOptionProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[staffStyles.row, selected && staffStyles.rowSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <AvatarInitials name={staff.name} avatarUrl={staff.avatar_url} size={40} />
      <View style={staffStyles.info}>
        <Text style={staffStyles.name}>{staff.name}</Text>
        <Text style={staffStyles.role}>{staff.role}</Text>
      </View>
      <View style={[staffStyles.radio, selected && staffStyles.radioSelected]}>
        {selected && <View style={staffStyles.radioInner} />}
      </View>
    </TouchableOpacity>
  );
}

const staffStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  rowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  role: {
    ...typography.caption,
    color: colors.textMuted,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
});

interface ServiceOptionProps {
  service: ServiceItemDto;
  selected: boolean;
  onSelect: () => void;
}

function ServiceOption({ service, selected, onSelect }: ServiceOptionProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[serviceStyles.row, selected && serviceStyles.rowSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={serviceStyles.info}>
        <Text style={serviceStyles.name}>{service.name}</Text>
        <Text style={serviceStyles.meta}>{service.duration_minutes} мин</Text>
      </View>
      <Text style={[serviceStyles.price, selected && serviceStyles.priceSelected]}>
        {service.price.toLocaleString('ru-RU')} ₽
      </Text>
      <View style={[serviceStyles.radio, selected && serviceStyles.radioSelected]}>
        {selected && <View style={serviceStyles.radioInner} />}
      </View>
    </TouchableOpacity>
  );
}

const serviceStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  rowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.body,
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  price: {
    ...typography.bodyMedium,
    color: colors.accent,
    marginRight: spacing.sm,
  },
  priceSelected: {
    color: colors.accent,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
});

// ─── BookingCreateResponse ─────────────────────────────────────────────────────

interface BookingCreateResponse {
  id: string;
  slot_date: string;
  slot_start_time: string;
  service_name: string;
  service_price: number;
  business_name: string;
  staff_name: string;
}

// ─── BookingSlotsScreen ────────────────────────────────────────────────────────

export function BookingSlotsScreen({ navigation, route }: Props): React.JSX.Element {
  const { businessId, staffId: initialStaffId } = route.params;
  const insets = useSafeAreaInsets();

  // Business data
  const [business, setBusiness] = useState<BusinessDetailDto | null>(null);
  const [isLoadingBusiness, setIsLoadingBusiness] = useState(true);

  // Selection state
  const [selectedStaffId, setSelectedStaffId] = useState<string | undefined>(initialStaffId);
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<string>(formatDateIso(new Date()));
  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>(undefined);

  // Slots
  const [slots, setSlots] = useState<SlotItemDto[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Booking
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const calendarDays = useMemo(() => generateCalendarDays(30), []);

  // ── Load business ──────────────────────────────────────────────────────────
  useEffect(() => {
    apiClient
      .get<BusinessDetailDto>(`/businesses/${businessId}`)
      .then((res) => {
        setBusiness(res.data);
        if (res.data.services.length === 1) {
          setSelectedServiceId(res.data.services[0]?.id);
        }
        if (!initialStaffId && res.data.staff.length === 1) {
          setSelectedStaffId(res.data.staff[0]?.id);
        }
      })
      .catch(() => {
        // will show error state
      })
      .finally(() => setIsLoadingBusiness(false));
  }, [businessId, initialStaffId]);

  // ── Load slots when date or staff changes ──────────────────────────────────
  useEffect(() => {
    setIsLoadingSlots(true);
    setSelectedSlotId(undefined);
    setBookingError(null);

    const params: Record<string, string> = { date: selectedDate };
    if (selectedStaffId) params['staff_id'] = selectedStaffId;

    apiClient
      .get<{ slots: SlotItemDto[] }>(`/businesses/${businessId}/slots`, { params })
      .then((res) => setSlots((res.data.slots ?? []).filter((s) => !s.is_booked)))
      .catch(() => setSlots([]))
      .finally(() => setIsLoadingSlots(false));
  }, [businessId, selectedDate, selectedStaffId]);

  // ── Book ───────────────────────────────────────────────────────────────────
  const handleBook = useCallback(async () => {
    if (!selectedSlotId || !selectedServiceId) return;
    setIsBooking(true);
    setBookingError(null);
    try {
      const res = await apiClient.post<{ booking: BookingCreateResponse }>('/bookings', {
        slot_id: selectedSlotId,
        service_id: selectedServiceId,
      });
      const b = res.data.booking;
      navigation.replace('BookingConfirm', {
        bookingId: b.id,
        businessName: b.business_name,
        staffName: b.staff_name,
        serviceName: b.service_name,
        date: b.slot_date,
        startTime: b.slot_start_time,
        price: b.service_price,
      });
    } catch {
      setBookingError('Не удалось создать запись. Попробуйте другой слот.');
    } finally {
      setIsBooking(false);
    }
  }, [selectedSlotId, selectedServiceId, navigation]);

  // ── Loading / Error states ─────────────────────────────────────────────────
  if (isLoadingBusiness) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnFallback}>
          <Text style={styles.backBtnText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.errorText}>Не удалось загрузить данные</Text>
      </View>
    );
  }

  const canConfirm = !!selectedSlotId && !!selectedServiceId;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Запись в {business.name}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Master selection */}
        {business.staff.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Мастер</Text>
            {business.staff.map((staff) => (
              <StaffOption
                key={staff.id}
                staff={staff}
                selected={selectedStaffId === staff.id}
                onSelect={() => {
                  setSelectedStaffId(staff.id);
                  setSelectedSlotId(undefined);
                }}
              />
            ))}
          </View>
        )}

        {/* Service selection */}
        {business.services.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Услуга</Text>
            {business.services.map((service) => (
              <ServiceOption
                key={service.id}
                service={service}
                selected={selectedServiceId === service.id}
                onSelect={() => setSelectedServiceId(service.id)}
              />
            ))}
          </View>
        )}

        {/* Horizontal calendar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Дата</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.calendarContent}
          >
            {calendarDays.map((day) => {
              const dateStr = formatDateIso(day);
              const isSelected = selectedDate === dateStr;
              const dayName = DAY_SHORT[day.getDay()] ?? '';
              const monthName = MONTH_SHORT[day.getMonth()] ?? '';
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                  onPress={() => setSelectedDate(dateStr)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayName, isSelected && styles.dayTextSelected]}>
                    {dayName}
                  </Text>
                  <Text style={[styles.dayNum, isSelected && styles.dayTextSelected]}>
                    {day.getDate()}
                  </Text>
                  <Text style={[styles.dayMonth, isSelected && styles.dayTextSelected]}>
                    {monthName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Slots */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Время · {formatDisplayDate(selectedDate)}
          </Text>
          {isLoadingSlots ? (
            <ActivityIndicator color={colors.accent} style={styles.slotsLoader} />
          ) : slots.length === 0 ? (
            <Text style={styles.noSlots}>Нет свободных слотов на эту дату</Text>
          ) : (
            <View style={styles.slotsGrid}>
              {slots.map((slot) => (
                <SlotChip
                  key={slot.id}
                  time={slot.start_time.slice(0, 5)}
                  selected={selectedSlotId === slot.id}
                  onPress={() => setSelectedSlotId(slot.id)}
                />
              ))}
            </View>
          )}
        </View>

        {bookingError !== null && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{bookingError}</Text>
          </View>
        )}
      </ScrollView>

      {/* Confirm button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TouchableOpacity
          style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
          onPress={() => void handleBook()}
          disabled={!canConfirm || isBooking}
          activeOpacity={0.8}
        >
          {isBooking ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.confirmBtnText}>Подтвердить запись</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  backBtnFallback: {
    padding: spacing.sm,
  },
  backBtnText: {
    ...typography.h3,
    color: colors.accent,
  },
  headerTitle: {
    flex: 1,
    ...typography.bodyMedium,
    color: colors.text,
  },
  headerPlaceholder: {
    width: 32,
  },
  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 0,
  },
  // Section
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  // Calendar
  calendarContent: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  dayChip: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 2,
  },
  dayChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayName: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  dayNum: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  dayMonth: {
    ...typography.caption,
    color: colors.textMuted,
  },
  dayTextSelected: {
    color: colors.white,
  },
  // Slots
  slotsLoader: {
    marginVertical: spacing.lg,
  },
  noSlots: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // Error
  errorText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  errorBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.coralLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  errorBannerText: {
    ...typography.body,
    color: colors.coral,
  },
  // Footer
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  confirmBtn: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  confirmBtnDisabled: {
    backgroundColor: colors.textMuted,
  },
  confirmBtnText: {
    ...typography.button,
    color: colors.white,
  },
});
