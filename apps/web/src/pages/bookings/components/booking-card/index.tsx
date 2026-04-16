import React from 'react';
import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import { getStatusBadge } from '../../../../utils/get-status-badge';
import { DetailsRow } from '../details-row';
import { bookingCardDateFormatter, bookingCardPriceFormatter } from './constants';
import { BookingCardProps } from './types';

const formatBookingDate = (date: string): string => bookingCardDateFormatter.format(new Date(date));

const formatBookingPrice = (price: number): string =>
  `${bookingCardPriceFormatter.format(price)} ₽`;

export const BookingCard = ({
  booking,
  unreadCount,
  onOpenChat,
  onComplete,
  onCancel,
  isCompleting,
  isCancelling,
}: BookingCardProps): React.JSX.Element => {
  const { color, label } = getStatusBadge(booking.status);
  const isWalkIn = booking.source === 'walk_in';
  const isLink = booking.source === 'link';
  const hasChat = booking.status === 'confirmed' && booking.source === 'app';
  const hasUnread = unreadCount > 0;

  return (
    <Card withBorder radius="xl" padding="lg" shadow="sm">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={2}>
            <Text size="sm" fw={600}>
              {formatBookingDate(booking.slot_date)}
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
            {isLink && (
              <Badge color="blue" variant="light" radius="xl" tt="none">
                Ссылка
              </Badge>
            )}
            <Badge color={color} variant="light" radius="xl" tt="none">
              {label}
            </Badge>
          </Group>
        </Group>

        <Stack gap="sm">
          <DetailsRow label="Услуга:" value={booking.service_name} />
          <DetailsRow label="Цена:" value={formatBookingPrice(booking.service_price)} />
          <DetailsRow label="Клиент:" value={booking.client_name ?? 'Клиент'} />
          <DetailsRow label="Телефон:" value={booking.client_phone ?? '—'} />
          <DetailsRow label="Мастер:" value={booking.staff_name} />
        </Stack>

        {booking.status === 'confirmed' && (
          <>
            <Group grow>
              <Button
                color="teal"
                variant="light"
                loading={isCompleting}
                disabled={isCancelling}
                onClick={() => onComplete(booking)}
              >
                Завершить
              </Button>
              <Button
                color="red"
                variant="light"
                loading={isCancelling}
                disabled={isCompleting}
                onClick={() => onCancel(booking)}
              >
                Отменить
              </Button>
            </Group>

            {hasChat ? (
              <Button
                variant="light"
                color="teal"
                fullWidth
                disabled={isCompleting || isCancelling}
                onClick={() => onOpenChat(booking)}
                rightSection={
                  hasUnread ? (
                    <Badge color="red" size="sm" circle>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  ) : undefined
                }
              >
                💬 Чат с клиентом
              </Button>
            ) : null}
          </>
        )}
      </Stack>
    </Card>
  );
};
