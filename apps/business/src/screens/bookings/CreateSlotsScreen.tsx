import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { SlotItemDto, StaffItemDto } from '@mettig/shared';
import type { BookingsStackScreenProps } from '../../navigation/types';

type Props = BookingsStackScreenProps<'CreateSlots'>;

function formatDateDisplay(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatDateApi(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DAY_NAMES_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function generateUpcomingDates(days: number): Date[] {
  const dates: Date[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h <= 21; h++) {
    for (const m of ['00', '30']) {
      const time = `${String(h).padStart(2, '0')}:${m}`;
      if (time <= '21:30') {
        slots.push(time);
      }
    }
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();
const UPCOMING_DATES = generateUpcomingDates(21);

function isPastDate(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const candidate = new Date(date);
  candidate.setHours(0, 0, 0, 0);
  return candidate.getTime() < today.getTime();
}

function isPastSlot(date: Date, time: string): boolean {
  const [hours, minutes] = time.split(':').map(Number);
  const candidate = new Date(date);
  candidate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return candidate.getTime() < Date.now();
}

export function CreateSlotsScreen({ route, navigation }: Props): React.JSX.Element {
  const initialStaffId = route.params?.staffId ?? null;

  const [staff, setStaff] = useState<StaffItemDto[]>([]);
  const [currentStaff, setCurrentStaff] = useState<StaffItemDto | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffLoading, setStaffLoading] = useState(true);

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(initialStaffId);
  const [selectedDate, setSelectedDate] = useState<Date>(UPCOMING_DATES[0] ?? new Date());
  const [selectedTimes, setSelectedTimes] = useState<Set<string>>(new Set());
  const [existingSlots, setExistingSlots] = useState<SlotItemDto[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingSlotId, setDeletingSlotId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [{ data: staffData }, { data: currentStaffData }] = await Promise.all([
          apiClient.get<{ staff: StaffItemDto[] }>('/business/staff'),
          apiClient.get<{ staff: StaffItemDto }>('/business/staff/me'),
        ]);

        setStaff(staffData.staff);
        setCurrentStaff(currentStaffData.staff);

        const admin = currentStaffData.staff.role === 'admin';
        setIsAdmin(admin);

        if (admin) {
          if (initialStaffId) {
            setSelectedStaffId(initialStaffId);
          } else {
            setSelectedStaffId(staffData.staff[0]?.id ?? null);
          }
        } else {
          setSelectedStaffId(currentStaffData.staff.id);
        }
      } catch {
        Alert.alert('Ошибка', 'Не удалось загрузить данные мастера');
      } finally {
        setStaffLoading(false);
      }
    })();
  }, [initialStaffId]);

  const loadExistingSlots = useCallback(async () => {
    if (!selectedStaffId) {
      setExistingSlots([]);
      return;
    }

    setSlotsLoading(true);
    try {
      const { data } = await apiClient.get<{ slots: SlotItemDto[] }>('/business/slots', {
        params: {
          staff_id: selectedStaffId,
          date: formatDateApi(selectedDate),
        },
      });
      setExistingSlots(data.slots);
      const existingTimes = new Set(data.slots.map((slot) => slot.start_time));
      setSelectedTimes((prev) => new Set(Array.from(prev).filter((time) => !existingTimes.has(time))));
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить слоты на выбранную дату');
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedDate, selectedStaffId]);

  useEffect(() => {
    void loadExistingSlots();
  }, [loadExistingSlots]);

  useEffect(() => {
    setSelectedTimes((prev) => {
      const nextValues = Array.from(prev).filter((time) => !isPastSlot(selectedDate, time));
      if (nextValues.length === prev.size) {
        return prev;
      }
      return new Set(nextValues);
    });
  }, [selectedDate]);

  const toggleTime = useCallback((time: string) => {
    setSelectedTimes((prev) => {
      const next = new Set(prev);
      if (next.has(time)) {
        next.delete(time);
      } else {
        next.add(time);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedStaffId) {
      Alert.alert('Ошибка', 'Выберите мастера');
      return;
    }
    if (selectedTimes.size === 0) {
      Alert.alert('Ошибка', 'Выберите хотя бы одно время');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await apiClient.post<{ slots: SlotItemDto[] }>('/business/slots', {
        staff_id: selectedStaffId,
        date: formatDateApi(selectedDate),
        times: Array.from(selectedTimes).sort(),
      });

      setSelectedTimes(new Set());
      await loadExistingSlots();

      if (data.slots.length === 0) {
        Alert.alert('Без изменений', 'Все выбранные слоты уже были открыты');
        return;
      }

      Alert.alert(
        'Готово',
        `Создано ${data.slots.length} слот(ов) на ${formatDateDisplay(selectedDate)}`,
      );
    } catch {
      Alert.alert('Ошибка', 'Не удалось создать слоты');
    } finally {
      setSubmitting(false);
    }
  }, [loadExistingSlots, selectedDate, selectedStaffId, selectedTimes]);

  const handleDeleteSlot = useCallback((slot: SlotItemDto) => {
    if (slot.is_booked) {
      return;
    }

    Alert.alert(
      'Удалить слот?',
      `${slot.start_time} на ${formatDateDisplay(selectedDate)}`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeletingSlotId(slot.id);
              try {
                await apiClient.delete(`/business/slots/${slot.id}`);
                await loadExistingSlots();
              } catch {
                Alert.alert('Ошибка', 'Не удалось удалить слот');
              } finally {
                setDeletingSlotId(null);
              }
            })();
          },
        },
      ],
    );
  }, [loadExistingSlots, selectedDate]);

  const isSameDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const existingSlotsByTime = useMemo(
    () => new Map(existingSlots.map((slot) => [slot.start_time, slot])),
    [existingSlots],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Управление слотами</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Мастер</Text>
        {staffLoading ? (
          <ActivityIndicator color="#1D6B4F" style={styles.loader} />
        ) : !isAdmin ? (
          <View style={styles.readOnlyStaffCard}>
            <Text style={styles.readOnlyStaffName}>{currentStaff?.name ?? 'Текущий мастер'}</Text>
            <Text style={styles.readOnlyStaffHint}>Вы управляете только своими слотами</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {staff.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.chip, selectedStaffId === item.id && styles.chipActive]}
                onPress={() => {
                  setSelectedStaffId(item.id);
                  setSelectedTimes(new Set());
                }}
              >
                <Text style={[styles.chipText, selectedStaffId === item.id && styles.chipTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Text style={styles.sectionTitle}>Дата</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {UPCOMING_DATES.map((date) => {
            const isSelected = isSameDate(date, selectedDate);
            const isDisabled = isPastDate(date);
            return (
              <TouchableOpacity
                key={date.toISOString()}
                style={[
                  styles.dateCell,
                  isSelected && styles.dateCellActive,
                  isDisabled && styles.dateCellDisabled,
                ]}
                onPress={() => {
                  if (!isDisabled) {
                    setSelectedDate(date);
                    setSelectedTimes(new Set());
                  }
                }}
                disabled={isDisabled}
              >
                <Text style={[
                  styles.dateDayName,
                  isSelected && styles.dateDayNameActive,
                  isDisabled && styles.dateTextDisabled,
                ]}>
                  {DAY_NAMES_SHORT[date.getDay()]}
                </Text>
                <Text style={[
                  styles.dateDayNum,
                  isSelected && styles.dateDayNumActive,
                  isDisabled && styles.dateTextDisabled,
                ]}>
                  {date.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.selectedDateText}>{formatDateDisplay(selectedDate)}</Text>

        <Text style={styles.sectionTitle}>Открытые слоты</Text>
        {slotsLoading ? (
          <ActivityIndicator color="#1D6B4F" style={styles.loader} />
        ) : existingSlots.length === 0 ? (
          <Text style={styles.helperText}>На эту дату ещё нет открытых слотов</Text>
        ) : (
          <View style={styles.timesGrid}>
            {existingSlots.map((slot) => {
              const isDeleting = deletingSlotId === slot.id;
              const isPast = isPastSlot(selectedDate, slot.start_time);
              return (
                <TouchableOpacity
                  key={slot.id}
                  style={[
                    styles.existingSlotChip,
                    (slot.is_booked || isPast) ? styles.existingSlotChipBooked : styles.existingSlotChipFree,
                  ]}
                  onPress={() => handleDeleteSlot(slot)}
                  disabled={slot.is_booked || isPast || isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#1D6B4F" />
                  ) : (
                    <Text style={[styles.existingSlotText, slot.is_booked && styles.existingSlotTextBooked]}>
                      {slot.start_time}
                      {slot.is_booked ? ' • занято' : isPast ? ' • прошло' : ' • удалить'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionTitle}>
          Новые слоты{selectedTimes.size > 0 ? ` (выбрано: ${selectedTimes.size})` : ''}
        </Text>
        <View style={styles.timesGrid}>
          {TIME_SLOTS.map((time) => {
            const isSelected = selectedTimes.has(time);
            const isUnavailable = existingSlotsByTime.has(time);
            const isPast = isPastSlot(selectedDate, time);
            return (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timeChip,
                  isSelected && styles.timeChipActive,
                  (isUnavailable || isPast) && styles.timeChipDisabled,
                ]}
                onPress={() => {
                  if (!isUnavailable && !isPast) {
                    toggleTime(time);
                  }
                }}
                disabled={isUnavailable || isPast}
              >
                <Text
                  style={[
                    styles.timeChipText,
                    isSelected && styles.timeChipTextActive,
                    (isUnavailable || isPast) && styles.timeChipTextDisabled,
                  ]}
                >
                  {time}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (submitting || selectedTimes.size === 0) && styles.submitButtonDisabled,
          ]}
          onPress={() => void handleSubmit()}
          disabled={submitting || selectedTimes.size === 0}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>
              Создать {selectedTimes.size > 0 ? `${selectedTimes.size} слот(ов)` : 'слоты'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8A8A86',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 20,
  },
  loader: {
    marginVertical: 16,
  },
  readOnlyStaffCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readOnlyStaffName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A18',
  },
  readOnlyStaffHint: {
    fontSize: 12,
    color: '#777772',
    marginTop: 4,
  },
  chipRow: {
    gap: 8,
    alignItems: 'center',
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E4',
  },
  chipActive: {
    backgroundColor: '#1D6B4F',
    borderColor: '#1D6B4F',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5C5C58',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  dateCell: {
    width: 48,
    height: 64,
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
  dateCellDisabled: {
    backgroundColor: '#F1F1ED',
    borderColor: '#E1E1DA',
  },
  dateDayName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8A8A86',
    marginBottom: 4,
  },
  dateDayNameActive: {
    color: '#E8F4EF',
  },
  dateDayNum: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A18',
  },
  dateDayNumActive: {
    color: '#FFFFFF',
  },
  dateTextDisabled: {
    color: '#A0A09A',
  },
  selectedDateText: {
    fontSize: 13,
    color: '#5C5C58',
    marginTop: 8,
    textAlign: 'center',
  },
  helperText: {
    fontSize: 13,
    color: '#777772',
  },
  timesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E4',
    minWidth: 64,
    alignItems: 'center',
  },
  timeChipActive: {
    backgroundColor: '#1D6B4F',
    borderColor: '#1D6B4F',
  },
  timeChipDisabled: {
    backgroundColor: '#F1F1ED',
    borderColor: '#E1E1DA',
  },
  timeChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A18',
  },
  timeChipTextActive: {
    color: '#FFFFFF',
  },
  timeChipTextDisabled: {
    color: '#A0A09A',
  },
  existingSlotChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 110,
    alignItems: 'center',
  },
  existingSlotChipFree: {
    backgroundColor: '#F6FBF8',
    borderColor: '#B9DDCC',
  },
  existingSlotChipBooked: {
    backgroundColor: '#F7F7F4',
    borderColor: '#E1E1DA',
  },
  existingSlotText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1D6B4F',
  },
  existingSlotTextBooked: {
    color: '#777772',
  },
  submitButton: {
    marginTop: 32,
    backgroundColor: '#1D6B4F',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#8A8A86',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
