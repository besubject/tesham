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
import type { StaffItemDto } from '@mettig/shared';
import type { BookingsStackScreenProps } from '../../navigation/types';

type Props = BookingsStackScreenProps<'CreateSlots'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// Generate time slots from 08:00 to 21:30 in 30-min intervals
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

// ─── CreateSlotsScreen ────────────────────────────────────────────────────────

export function CreateSlotsScreen({ route, navigation }: Props): React.JSX.Element {
  const initialStaffId = route.params?.staffId ?? null;

  const [staff, setStaff] = useState<StaffItemDto[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(initialStaffId);
  const [selectedDate, setSelectedDate] = useState<Date>(UPCOMING_DATES[0] ?? new Date());
  const [selectedTimes, setSelectedTimes] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await apiClient.get<{ staff: StaffItemDto[] }>('/business/staff');
        setStaff(data.staff);
        // Auto-select first staff if none pre-selected
        if (!initialStaffId && data.staff.length > 0) {
          setSelectedStaffId(data.staff[0]?.id ?? null);
        }
      } catch {
        Alert.alert('Ошибка', 'Не удалось загрузить список мастеров');
      } finally {
        setStaffLoading(false);
      }
    })();
  }, [initialStaffId]);

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
      await apiClient.post('/business/slots', {
        staff_id: selectedStaffId,
        date: formatDateApi(selectedDate),
        times: Array.from(selectedTimes).sort(),
      });
      Alert.alert(
        'Готово',
        `Создано ${selectedTimes.size} слот(ов) на ${formatDateDisplay(selectedDate)}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch {
      Alert.alert('Ошибка', 'Не удалось создать слоты');
    } finally {
      setSubmitting(false);
    }
  }, [selectedStaffId, selectedDate, selectedTimes, navigation]);

  const isSameDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Создать слоты</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Staff selection */}
        <Text style={styles.sectionTitle}>Мастер</Text>
        {staffLoading ? (
          <ActivityIndicator color="#1D6B4F" style={styles.loader} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {staff.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.chip, selectedStaffId === s.id && styles.chipActive]}
                onPress={() => setSelectedStaffId(s.id)}
              >
                <Text style={[styles.chipText, selectedStaffId === s.id && styles.chipTextActive]}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Date selection */}
        <Text style={styles.sectionTitle}>Дата</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {UPCOMING_DATES.map((d) => {
            const isSelected = isSameDate(d, selectedDate);
            return (
              <TouchableOpacity
                key={d.toISOString()}
                style={[styles.dateCell, isSelected && styles.dateCellActive]}
                onPress={() => {
                  setSelectedDate(d);
                  setSelectedTimes(new Set()); // clear time selection on date change
                }}
              >
                <Text style={[styles.dateDayName, isSelected && styles.dateDayNameActive]}>
                  {DAY_NAMES_SHORT[d.getDay()]}
                </Text>
                <Text style={[styles.dateDayNum, isSelected && styles.dateDayNumActive]}>
                  {d.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Selected date display */}
        <Text style={styles.selectedDateText}>{formatDateDisplay(selectedDate)}</Text>

        {/* Time selection */}
        <Text style={styles.sectionTitle}>
          Время{selectedTimes.size > 0 ? ` (выбрано: ${selectedTimes.size})` : ''}
        </Text>
        <View style={styles.timesGrid}>
          {TIME_SLOTS.map((time) => {
            const isSelected = selectedTimes.has(time);
            return (
              <TouchableOpacity
                key={time}
                style={[styles.timeChip, isSelected && styles.timeChipActive]}
                onPress={() => toggleTime(time)}
              >
                <Text style={[styles.timeChipText, isSelected && styles.timeChipTextActive]}>
                  {time}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Submit button */}
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
  // Date
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
  selectedDateText: {
    fontSize: 13,
    color: '#5C5C58',
    marginTop: 8,
    textAlign: 'center',
  },
  // Time grid
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
  timeChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A18',
  },
  timeChipTextActive: {
    color: '#FFFFFF',
  },
  // Submit
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
