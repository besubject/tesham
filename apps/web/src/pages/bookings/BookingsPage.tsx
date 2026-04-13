import React, { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { apiClient, type BusinessBookingItemDto } from '@mettig/shared';
import styles from './BookingsPage.module.scss';

import { getStatusBadge } from '../../utils/get-status-badge';
import { TStatus } from 'src/types';

interface BusinessBookingsResponseDto {
  bookings: BusinessBookingItemDto[];
}

export const BookingsPage = () => {
  const [status, setStatus] = useState<TStatus>('all');

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

  return (
    <div className={styles.bookingsPage}>
      <Stack gap="xs">
        <Title order={1}>Записи</Title>
        <Text c="dimmed">Управление записями клиентов</Text>
      </Stack>

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
                    <Badge color={color} variant="light" radius="xl" tt="none">
                      {label}
                    </Badge>
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
                        {booking.client_name}
                      </Text>
                    </Group>
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Text c="dimmed" fw={600} size="sm">
                        Телефон:
                      </Text>
                      <Text ta="right" fw={500} size="sm">
                        {booking.client_phone}
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
    </div>
  );
};
