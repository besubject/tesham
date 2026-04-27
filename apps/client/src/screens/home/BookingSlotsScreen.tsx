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
  BusinessDetailDto,
  colors,
  monoFont,
  ServiceItemDto,
  SlotItemDto,
  spacing,
  StaffItemDto,
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

function slotHour(time: string): number {
  return parseInt(time.slice(0, 2), 10);
}

const DAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const;
const MONTH_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'] as const;

// ─── MonoLabel ────────────────────────────────────────────────────────────────

function MonoLabel({ children, style }: { children: string; style?: object }): React.JSX.Element {
  return <Text style={[monoStyle, style]}>{children}</Text>;
}
const monoStyle = {
  fontFamily: monoFont,
  fontSize: 10,
  letterSpacing: 0.6,
  textTransform: 'uppercase' as const,
  color: colors.textMuted,
};

// ─── Slot chip ────────────────────────────────────────────────────────────────

interface SlotProps { time: string; selected: boolean; taken: boolean; onPress: () => void }

function SlotTile({ time, selected, taken, onPress }: SlotProps): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={taken}
      activeOpacity={0.7}
      style={[
        slotStyles.tile,
        selected && slotStyles.tileSelected,
        taken && slotStyles.tileTaken,
      ]}
    >
      <Text style={[
        slotStyles.label,
        selected && slotStyles.labelSelected,
        taken && slotStyles.labelTaken,
      ]}>
        {time}
      </Text>
    </TouchableOpacity>
  );
}

const slotStyles = StyleSheet.create({
  tile: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 80,
  },
  tileSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  tileTaken: {
    borderColor: colors.border,
    backgroundColor: 'transparent',
    opacity: 0.55,
  },
  label: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  labelSelected: { color: colors.surface },
  labelTaken: { color: colors.textMuted, textDecorationLine: 'line-through' },
});

// ─── Staff option ─────────────────────────────────────────────────────────────

interface StaffOptionProps { staff: StaffItemDto; selected: boolean; onSelect: () => void }

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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  rowSelected: { borderColor: colors.text, backgroundColor: colors.surfaceAlt },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  role: { fontFamily: monoFont, fontSize: 10, color: colors.textMuted, letterSpacing: 0.4 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.text },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.text },
});

// ─── Service option ───────────────────────────────────────────────────────────

interface ServiceOptionProps { service: ServiceItemDto; selected: boolean; onSelect: () => void }

function ServiceOption({ service, selected, onSelect }: ServiceOptionProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[svcStyles.row, selected && svcStyles.rowSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={svcStyles.info}>
        <Text style={svcStyles.name}>{service.name}</Text>
        <Text style={svcStyles.meta}>{service.duration_minutes} мин</Text>
      </View>
      <Text style={[svcStyles.price, selected && svcStyles.priceSelected]}>
        {service.price.toLocaleString('ru-RU')} ₽
      </Text>
      <View style={[svcStyles.radio, selected && svcStyles.radioSelected]}>
        {selected && <View style={svcStyles.radioInner} />}
      </View>
    </TouchableOpacity>
  );
}

const svcStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  rowSelected: { borderColor: colors.text, backgroundColor: colors.surfaceAlt },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, color: colors.text },
  meta: { fontFamily: monoFont, fontSize: 10, color: colors.textMuted, letterSpacing: 0.4 },
  price: { fontSize: 14, fontWeight: '500', color: colors.accent, marginRight: spacing.sm },
  priceSelected: { color: colors.text },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.text },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.text },
});

// ─── Booking response ─────────────────────────────────────────────────────────

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

  const [business, setBusiness] = useState<BusinessDetailDto | null>(null);
  const [isLoadingBusiness, setIsLoadingBusiness] = useState(true);

  const [selectedStaffId, setSelectedStaffId] = useState<string | undefined>(initialStaffId);
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<string>(formatDateIso(new Date()));
  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>(undefined);
  const [selectedSlotTime, setSelectedSlotTime] = useState<string | undefined>(undefined);

  const [slots, setSlots] = useState<SlotItemDto[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const calendarDays = useMemo(() => generateCalendarDays(30), []);

  // ── Load business ─────────────────────────────────────────────────────────
  useEffect(() => {
    apiClient
      .get<BusinessDetailDto>(`/businesses/${businessId}`)
      .then((res) => {
        setBusiness(res.data);
        if (res.data.services.length === 1) setSelectedServiceId(res.data.services[0]?.id);
        if (!initialStaffId && res.data.staff.length === 1) setSelectedStaffId(res.data.staff[0]?.id);
      })
      .catch(() => undefined)
      .finally(() => setIsLoadingBusiness(false));
  }, [businessId, initialStaffId]);

  // ── Load slots ────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsLoadingSlots(true);
    setSelectedSlotId(undefined);
    setSelectedSlotTime(undefined);
    setBookingError(null);
    const params: Record<string, string> = { date: selectedDate };
    if (selectedStaffId) params['staff_id'] = selectedStaffId;
    apiClient
      .get<{ slots: SlotItemDto[] }>(`/businesses/${businessId}/slots`, { params })
      .then((res) => setSlots((res.data.slots ?? []).filter((s) => !s.is_booked)))
      .catch(() => setSlots([]))
      .finally(() => setIsLoadingSlots(false));
  }, [businessId, selectedDate, selectedStaffId]);

  // ── Book ──────────────────────────────────────────────────────────────────
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

  // ── Slot groups ───────────────────────────────────────────────────────────
  const slotGroups = useMemo(() => {
    const morning = slots.filter((s) => slotHour(s.start_time) < 12);
    const afternoon = slots.filter((s) => { const h = slotHour(s.start_time); return h >= 12 && h < 17; });
    const evening = slots.filter((s) => slotHour(s.start_time) >= 17);
    return [
      { title: 'Утро', from: '09', to: '12', items: morning },
      { title: 'День', from: '12', to: '17', items: afternoon },
      { title: 'Вечер', from: '17', to: '22', items: evening },
    ].filter((g) => g.items.length > 0);
  }, [slots]);

  // ── Selected date display ─────────────────────────────────────────────────
  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y as number, (m as number) - 1, d as number);
  }, [selectedDate]);

  const selectedService = business?.services.find((s) => s.id === selectedServiceId);
  const ctaLabel = selectedSlotTime && selectedDate
    ? `${DAY_SHORT[selectedDateObj.getDay()]} · ${selectedDateObj.getDate()} ${MONTH_RU[selectedDateObj.getMonth()]} · ${selectedSlotTime} →`
    : 'Выбрать время';

  const canConfirm = !!selectedSlotId && !!selectedServiceId;

  // ── Loading ───────────────────────────────────────────────────────────────
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Progress: 1=staff, 2=service, 3=slot → at least we show step 2
  const progressStep = selectedSlotId ? 3 : selectedServiceId ? 2 : 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
          <MonoLabel>04 / Слот</MonoLabel>
        </View>

        {/* ── Progress bar ── */}
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, progressStep >= 1 && styles.progressBarFilled]} />
          <View style={[styles.progressBar, progressStep >= 2 && styles.progressBarFilled]} />
          <View style={[styles.progressBar, progressStep >= 3 && styles.progressBarFilled]} />
        </View>

        {/* ── Title ── */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            {'Удобное время'}
            <Text style={{ color: colors.accent }}>.</Text>
          </Text>
          <Text style={styles.subTitle}>
            {business.name}
            {selectedService != null ? ` · ${selectedService.name} · ${selectedService.duration_minutes} мин` : ''}
          </Text>
        </View>

        {/* ── Staff selection ── */}
        {business.staff.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Мастер</Text>
            </View>
            {business.staff.map((staff) => (
              <StaffOption
                key={staff.id}
                staff={staff}
                selected={selectedStaffId === staff.id}
                onSelect={() => {
                  setSelectedStaffId(staff.id);
                  setSelectedSlotId(undefined);
                  setSelectedSlotTime(undefined);
                }}
              />
            ))}
          </View>
        )}

        {/* ── Service selection ── */}
        {business.services.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Услуга</Text>
            </View>
            {business.services.map((svc) => (
              <ServiceOption
                key={svc.id}
                service={svc}
                selected={selectedServiceId === svc.id}
                onSelect={() => setSelectedServiceId(svc.id)}
              />
            ))}
          </View>
        )}

        {/* ── Date picker ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Дата</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.calendarRow}
          >
            {calendarDays.map((day) => {
              const dateStr = formatDateIso(day);
              const active = selectedDate === dateStr;
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  onPress={() => setSelectedDate(dateStr)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayName, active && styles.dayTextActive]}>
                    {DAY_SHORT[day.getDay()]}
                  </Text>
                  <Text style={[styles.dayNum, active && styles.dayTextActive]}>
                    {day.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Slot groups ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Время</Text>
          </View>

          {isLoadingSlots ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />
          ) : slots.length === 0 ? (
            <Text style={styles.noSlots}>Нет свободных слотов</Text>
          ) : (
            slotGroups.map((group) => (
              <View key={group.title} style={styles.slotGroup}>
                <View style={styles.slotGroupHeader}>
                  <Text style={styles.slotGroupTitle}>{group.title}</Text>
                  <MonoLabel>{`${group.from}—${group.to} · ${group.items.length} свободно`}</MonoLabel>
                </View>
                <View style={styles.slotsGrid}>
                  {group.items.map((slot) => (
                    <SlotTile
                      key={slot.id}
                      time={slot.start_time.slice(0, 5)}
                      selected={selectedSlotId === slot.id}
                      taken={false}
                      onPress={() => {
                        setSelectedSlotId(slot.id);
                        setSelectedSlotTime(slot.start_time.slice(0, 5));
                      }}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>

        {bookingError != null && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{bookingError}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── CTA ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TouchableOpacity
          style={[styles.ctaBtn, !canConfirm && styles.ctaBtnDisabled]}
          onPress={() => void handleBook()}
          disabled={!canConfirm || isBooking}
          activeOpacity={0.85}
        >
          {isBooking ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.ctaBtnText}>{ctaLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { gap: 0 },
  backText: { fontSize: 16, color: colors.accent },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 20, color: colors.text, lineHeight: 24 },

  // Progress
  progressWrap: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressBarFilled: {
    backgroundColor: colors.text,
  },

  // Title
  titleBlock: { paddingHorizontal: 18, paddingBottom: 14 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8, lineHeight: 32, color: colors.text },
  subTitle: { marginTop: 6, fontSize: 12, color: colors.textMuted },

  // Sections
  section: { paddingHorizontal: 18, paddingBottom: 14 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text },

  // Calendar
  calendarRow: { gap: 8, paddingRight: spacing.md },
  dayChip: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 46,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayChipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  dayName: { fontFamily: monoFont, fontSize: 9, color: colors.textMuted },
  dayNum: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 4 },
  dayTextActive: { color: colors.surface },

  // Slot groups
  slotGroup: { marginBottom: 14 },
  slotGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 8,
  },
  slotGroupTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  noSlots: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },

  // Error
  errorBanner: {
    marginHorizontal: 18,
    marginBottom: spacing.sm,
    backgroundColor: colors.coralLight,
    borderRadius: 12,
    padding: spacing.md,
  },
  errorBannerText: { fontSize: 13, color: colors.coral },

  // Footer
  footer: {
    paddingHorizontal: 18,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
  },
  ctaBtn: {
    backgroundColor: colors.text,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  ctaBtnDisabled: { opacity: 0.4 },
  ctaBtnText: { fontSize: 14, fontWeight: '600', color: colors.surface },
});
