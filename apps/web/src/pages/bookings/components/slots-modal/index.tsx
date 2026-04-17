import { Button, Group, Loader, Modal, Select, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { apiClient, type SlotItemDto, type StaffItemDto } from '@mettig/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

interface SlotsModalProps {
  opened: boolean;
  onClose: () => void;
}

interface StaffListDto {
  staff: StaffItemDto[];
}

interface CurrentStaffDto {
  staff: StaffItemDto;
}

interface SlotsListDto {
  slots: SlotItemDto[];
}

const EMPTY_SLOTS: SlotItemDto[] = [];

function formatDateApi(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateLabel(date: Date): { day: string; date: string } {
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return {
    day: days[date.getDay()] ?? '',
    date: `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`,
  };
}

function generateUpcomingDates(days: number): Date[] {
  const result: Date[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const next = new Date(start);
    next.setDate(next.getDate() + i);
    result.push(next);
  }
  return result;
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

const UPCOMING_DATES = generateUpcomingDates(21);
const TIME_SLOTS = generateTimeSlots();

function getTodayApi(): string {
  return formatDateApi(new Date());
}

function getCurrentTimeApi(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function isPastDateValue(date: string): boolean {
  return date < getTodayApi();
}

function isPastSlotValue(date: string, time: string): boolean {
  return date < getTodayApi() || (date === getTodayApi() && time < getCurrentTimeApi());
}

export const SlotsModal = ({ opened, onClose }: SlotsModalProps) => {
  const queryClient = useQueryClient();
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(formatDateApi(UPCOMING_DATES[0] ?? new Date()));
  const [selectedTimes, setSelectedTimes] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [deletingSlotId, setDeletingSlotId] = useState<string | null>(null);

  const { data: staffData, isLoading: isStaffLoading } = useQuery<StaffListDto>({
    queryKey: ['business-staff'],
    queryFn: async () => {
      const { data } = await apiClient.get<StaffListDto>('/business/staff');
      return data;
    },
    enabled: opened,
  });

  const { data: currentStaffData, isLoading: isCurrentStaffLoading } = useQuery<CurrentStaffDto>({
    queryKey: ['business-staff-me'],
    queryFn: async () => {
      const { data } = await apiClient.get<CurrentStaffDto>('/business/staff/me');
      return data;
    },
    enabled: opened,
  });

  const currentStaff = currentStaffData?.staff ?? null;
  const isAdmin = currentStaff?.role === 'admin';

  const firstStaffId = staffData?.staff[0]?.id ?? null;

  useEffect(() => {
    if (!opened || !currentStaff) return;

    if (isAdmin) {
      setSelectedStaffId((prev) => prev ?? firstStaffId);
    } else {
      setSelectedStaffId(currentStaff.id);
    }
  }, [currentStaff, firstStaffId, isAdmin, opened]);

  useEffect(() => {
    if (!opened) {
      setSelectedTimes(new Set());
      setError(null);
      setDeletingSlotId(null);
    }
  }, [opened]);

  useEffect(() => {
    setSelectedTimes((prev) => {
      const nextValues = Array.from(prev).filter((time) => !isPastSlotValue(selectedDate, time));
      if (nextValues.length === prev.size) {
        return prev;
      }
      return new Set(nextValues);
    });
  }, [selectedDate]);

  const { data: slotsData, isLoading: isSlotsLoading, refetch: refetchSlots } = useQuery<SlotsListDto>({
    queryKey: ['business-slots', selectedStaffId, selectedDate],
    queryFn: async () => {
      const { data } = await apiClient.get<SlotsListDto>('/business/slots', {
        params: {
          staff_id: selectedStaffId ?? undefined,
          date: selectedDate,
        },
      });
      return data;
    },
    enabled: opened && Boolean(selectedStaffId),
  });

  const existingSlots = slotsData?.slots ?? EMPTY_SLOTS;
  const existingSlotsByTime = useMemo(
    () => new Map(existingSlots.map((slot) => [slot.start_time, slot])),
    [existingSlots],
  );

  useEffect(() => {
    const occupied = new Set(existingSlots.map((slot) => slot.start_time));
    setSelectedTimes((prev) => {
      const nextValues = Array.from(prev).filter((time) => !occupied.has(time));
      if (nextValues.length === prev.size) {
        return prev;
      }
      return new Set(nextValues);
    });
  }, [existingSlots]);

  const createSlotsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStaffId) {
        throw new Error('STAFF_REQUIRED');
      }
      return apiClient.post('/business/slots', {
        staff_id: selectedStaffId,
        date: selectedDate,
        times: Array.from(selectedTimes).sort(),
      });
    },
    onSuccess: async () => {
      setSelectedTimes(new Set());
      setError(null);
      await refetchSlots();
      await queryClient.invalidateQueries({ queryKey: ['business-slots'] });
    },
    onError: () => {
      setError('Не удалось создать слоты');
    },
  });

  const handleDeleteSlot = async (slot: SlotItemDto) => {
    if (slot.is_booked) return;

    setDeletingSlotId(slot.id);
    setError(null);
    try {
      await apiClient.delete(`/business/slots/${slot.id}`);
      await refetchSlots();
      await queryClient.invalidateQueries({ queryKey: ['business-slots'] });
    } catch {
      setError('Не удалось удалить слот');
    } finally {
      setDeletingSlotId(null);
    }
  };

  const staffOptions = (staffData?.staff ?? []).map((staff) => ({
    value: staff.id,
    label: staff.name,
  }));

  const isLoading = isStaffLoading || isCurrentStaffLoading;

  return (
    <Modal opened={opened} onClose={onClose} title="Управление слотами" size="xl" centered>
      <Stack gap="lg">
        {isLoading ? (
          <Group justify="center" py="xl">
            <Loader color="teal" />
          </Group>
        ) : (
          <>
            {isAdmin ? (
              <Select
                label="Мастер"
                placeholder="Выберите мастера"
                data={staffOptions}
                value={selectedStaffId}
                onChange={setSelectedStaffId}
                allowDeselect={false}
              />
            ) : (
              <Stack gap={2}>
                <Text size="sm" fw={500}>
                  Мастер
                </Text>
                <Text size="sm" c="dimmed">
                  {currentStaff?.name}
                </Text>
                <Text size="xs" c="dimmed">
                  Вы управляете только своими слотами
                </Text>
              </Stack>
            )}

            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Дата
              </Text>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {UPCOMING_DATES.map((date) => {
                  const value = formatDateApi(date);
                  const active = value === selectedDate;
                  const disabled = isPastDateValue(value);
                  const label = formatDateLabel(date);
                  return (
                    <UnstyledButton
                      key={value}
                      onClick={() => {
                        if (!disabled) {
                          setSelectedDate(value);
                          setSelectedTimes(new Set());
                        }
                      }}
                      disabled={disabled}
                      style={{
                        minWidth: 74,
                        padding: '10px 8px',
                        borderRadius: 12,
                        border: `1px solid ${active ? '#0f8a6c' : disabled ? '#e1e1da' : '#d9d9d1'}`,
                        background: active ? '#0f8a6c' : disabled ? '#f1f1ed' : '#ffffff',
                        color: active ? '#ffffff' : disabled ? '#a0a09a' : '#1f1f1b',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        flexShrink: 0,
                      }}
                    >
                      <Text size="xs" c={active ? '#dff7ef' : disabled ? '#a0a09a' : 'dimmed'} fw={500}>
                        {label.day}
                      </Text>
                      <Text size="sm" c={active ? '#ffffff' : disabled ? '#a0a09a' : '#1f1f1b'} fw={700}>
                        {label.date}
                      </Text>
                    </UnstyledButton>
                  );
                })}
              </div>
            </Stack>

            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Открытые слоты
              </Text>
              {isSlotsLoading ? (
                <Group justify="center" py="md">
                  <Loader size="sm" color="teal" />
                </Group>
              ) : existingSlots.length === 0 ? (
                <Text size="sm" c="dimmed">
                  На эту дату ещё нет открытых слотов
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="xs">
                  {existingSlots.map((slot) => {
                    const isDeleting = deletingSlotId === slot.id;
                    const isPast = isPastSlotValue(selectedDate, slot.start_time);
                    return (
                      <Button
                        key={slot.id}
                        variant="default"
                        color={slot.is_booked ? 'gray' : 'teal'}
                        disabled={slot.is_booked || isPast || isDeleting}
                        loading={isDeleting}
                        onClick={() => void handleDeleteSlot(slot)}
                      >
                        {slot.start_time}
                        {slot.is_booked ? ' • занято' : isPast ? ' • прошло' : ' • удалить'}
                      </Button>
                    );
                  })}
                </SimpleGrid>
              )}
            </Stack>

            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Новые слоты{selectedTimes.size > 0 ? ` (${selectedTimes.size})` : ''}
              </Text>
              <SimpleGrid cols={{ base: 3, sm: 4, md: 5 }} spacing="xs">
                {TIME_SLOTS.map((time) => {
                  const isSelected = selectedTimes.has(time);
                  const isDisabled = existingSlotsByTime.has(time) || isPastSlotValue(selectedDate, time);
                  return (
                    <Button
                      key={time}
                      variant={isSelected ? 'filled' : 'default'}
                      color={isSelected ? 'teal' : 'gray'}
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return;
                        setSelectedTimes((prev) => {
                          const next = new Set(prev);
                          if (next.has(time)) {
                            next.delete(time);
                          } else {
                            next.add(time);
                          }
                          return next;
                        });
                      }}
                    >
                      {time}
                    </Button>
                  );
                })}
              </SimpleGrid>
            </Stack>

            {error ? (
              <Text size="sm" c="red">
                {error}
              </Text>
            ) : null}

            <Group justify="flex-end">
              <Button variant="default" onClick={onClose}>
                Закрыть
              </Button>
              <Button
                color="teal"
                disabled={selectedTimes.size === 0}
                loading={createSlotsMutation.isPending}
                onClick={() => void createSlotsMutation.mutateAsync()}
              >
                Создать слоты
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
};
