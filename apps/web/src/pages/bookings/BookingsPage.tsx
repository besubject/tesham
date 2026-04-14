import React, { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, trackEvent, type BusinessBookingItemDto, type ServiceItemDto, type StaffItemDto } from '@mettig/shared';
import styles from './BookingsPage.module.scss';

import { getStatusBadge } from '../../utils/get-status-badge';
import { TStatus } from 'src/types';

interface BusinessBookingsResponseDto {
  bookings: BusinessBookingItemDto[];
}

interface StaffListDto {
  staff: StaffItemDto[];
}

interface ServicesListDto {
  services: ServiceItemDto[];
}

// ─── WalkInModal ──────────────────────────────────────────────────────────────

interface WalkInModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function WalkInModal({ opened, onClose, onCreated }: WalkInModalProps): React.JSX.Element {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customTime, setCustomTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: staffData } = useQuery<StaffListDto>({
    queryKey: ['business-staff'],
    queryFn: async () => {
      const { data } = await apiClient.get<StaffListDto>('/business/staff');
      return data;
    },
    enabled: opened,
  });

  const { data: servicesData } = useQuery<ServicesListDto>({
    queryKey: ['business-services'],
    queryFn: async () => {
      const { data } = await apiClient.get<ServicesListDto>('/business/services');
      return data;
    },
    enabled: opened,
  });

  const staffOptions = (staffData?.staff ?? []).map((s) => ({ value: s.id, label: s.name }));
  const serviceOptions = (servicesData?.services ?? []).map((s) => ({
    value: s.id,
    label: `${s.name} — ${s.price.toLocaleString('ru-RU')} ₽`,
  }));

  useEffect(() => {
    if (opened) {
      void trackEvent({ event_type: 'walk_in_form_opened' });
    }
  }, [opened]);

  const handleSubmit = async () => {
    if (!serviceId) {
      setError('Выберите услугу');
      return;
    }
    if (!staffId) {
      setError('Выберите мастера');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post('/business/bookings/walk-in', {
        staff_id: staffId,
        service_id: serviceId,
        client_name: clientName.trim() || undefined,
        client_phone: clientPhone.trim() || undefined,
        time: useCustomTime && customTime ? customTime : undefined,
      });
      await trackEvent({ event_type: 'walk_in_booking_created', payload: { has_phone: Boolean(clientPhone.trim()) } });
      // Reset form
      setStaffId(null);
      setServiceId(null);
      setClientName('');
      setClientPhone('');
      setUseCustomTime(false);
      setCustomTime('');
      setError(null);
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Не удалось добавить клиента');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Оффлайн-клиент"
      size="md"
      centered
    >
      <Stack gap="md">
        <Select
          label="Мастер"
          placeholder="Выберите мастера"
          data={staffOptions}
          value={staffId}
          onChange={setStaffId}
          required
        />

        <Select
          label="Услуга"
          placeholder="Выберите услугу"
          data={serviceOptions}
          value={serviceId}
          onChange={setServiceId}
          required
        />

        <TextInput
          label="Имя клиента (необязательно)"
          placeholder="Клиент"
          value={clientName}
          onChange={(e) => setClientName(e.currentTarget.value)}
        />

        <TextInput
          label="Телефон (необязательно)"
          placeholder="+7 (___) ___-__-__"
          value={clientPhone}
          onChange={(e) => setClientPhone(e.currentTarget.value)}
        />

        <Switch
          label="Указать конкретное время"
          checked={useCustomTime}
          onChange={(e) => setUseCustomTime(e.currentTarget.checked)}
        />

        {useCustomTime && (
          <TextInput
            label="Время (ЧЧ:ММ)"
            placeholder="14:30"
            value={customTime}
            onChange={(e) => setCustomTime(e.currentTarget.value)}
            maxLength={5}
          />
        )}

        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}

        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button color="teal" loading={submitting} onClick={() => void handleSubmit()}>
            Добавить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ─── BookingsPage ─────────────────────────────────────────────────────────────

export const BookingsPage = () => {
  const [status, setStatus] = useState<TStatus>('all');
  const [walkInOpened, setWalkInOpened] = useState(false);
  const queryClient = useQueryClient();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['business-bookings', status],
    queryFn: async () => {
      const { data } = await apiClient.get<BusinessBookingsResponseDto>('/business/bookings', {
        params: {
          status: status === 'all' ? undefined : status,
        },
      });
      console.log({ data });
      return data.bookings;
    },
  });

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleCreated = () => {
    void queryClient.invalidateQueries({ queryKey: ['business-bookings'] });
  };

  return (
    <div className={styles.bookingsPage}>
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs">
          <Title order={1}>Записи</Title>
          <Text c="dimmed">Управление записями клиентов</Text>
        </Stack>
        <Button
          color="teal"
          onClick={() => setWalkInOpened(true)}
          style={{ marginTop: 4 }}
        >
          + Клиент
        </Button>
      </Group>

      <Tabs
        variant="pills"
        value={status}
        onChange={(value) => setStatus((value as TStatus) ?? 'all')}
        keepMounted={false}
      >
        <Tabs.List>
          <Tabs.Tab value="all">Все</Tabs.Tab>
          <Tabs.Tab value="confirmed">Подтверждены</Tabs.Tab>
          <Tabs.Tab value="completed">Завершены</Tabs.Tab>
          <Tabs.Tab value="cancelled">Отменены</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {isLoading ? (
        <Card withBorder className={styles.loader} radius="lg" padding="xl">
          <Loader size={30} />
        </Card>
      ) : bookings?.length === 0 ? (
        <Card withBorder radius="lg" padding="xl">
          <Stack gap={4} align="center">
            <Text fw={600}>Нет записей</Text>
            <Text size="sm" c="dimmed" ta="center">
              Когда появятся бронирования, они будут отображаться здесь.
            </Text>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="lg">
          {bookings.map((booking) => {
            const { color, label } = getStatusBadge(booking.status);
            const isWalkIn = booking.source === 'walk_in';
            return (
              <Card key={booking.id} withBorder radius="xl" padding="lg" shadow="sm">
                <Stack gap="lg">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={2}>
                      <Text size="sm" fw={600}>
                        {formatDate(booking.slot_date)}
                      </Text>
                      <Text size="1.75rem" fw={700} c="red.6" lh={1}>
                        {booking.slot_start_time}
                      </Text>
                    </Stack>
                    <Group gap={6}>
                      {isWalkIn && (
                        <Badge color="yellow" variant="light" radius="xl" tt="none">
                          Walk-in
                        </Badge>
                      )}
                      <Badge color={color} variant="light" radius="xl" tt="none">
                        {label}
                      </Badge>
                    </Group>
                  </Group>

                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Text c="dimmed" fw={600} size="sm">
                        Услуга:
                      </Text>
                      <Text ta="right" fw={500} size="sm">
                        {booking.service_name}
                      </Text>
                    </Group>
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Text c="dimmed" fw={600} size="sm">
                        Цена:
                      </Text>
                      <Text ta="right" fw={500} size="sm">
                        {booking.service_price.toLocaleString('ru-RU')} ₽
                      </Text>
                    </Group>
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Text c="dimmed" fw={600} size="sm">
                        Клиент:
                      </Text>
                      <Text ta="right" fw={500} size="sm">
                        {booking.client_name ?? 'Клиент'}
                      </Text>
                    </Group>
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Text c="dimmed" fw={600} size="sm">
                        Телефон:
                      </Text>
                      <Text ta="right" fw={500} size="sm">
                        {booking.client_phone ?? '—'}
                      </Text>
                    </Group>
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Text c="dimmed" fw={600} size="sm">
                        Мастер:
                      </Text>
                      <Text ta="right" fw={500} size="sm">
                        {booking.staff_name}
                      </Text>
                    </Group>
                  </Stack>

                  {booking.status === 'confirmed' && (
                    <Group grow>
                      <Button color="teal" variant="light">
                        Завершить
                      </Button>
                      <Button color="red" variant="light">
                        Отменить
                      </Button>
                    </Group>
                  )}
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      )}

      <WalkInModal
        opened={walkInOpened}
        onClose={() => setWalkInOpened(false)}
        onCreated={handleCreated}
      />
    </div>
  );
};
