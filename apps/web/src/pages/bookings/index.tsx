import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Group,
  Pagination,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, type BusinessBookingItemDto, type ChatUnreadCountDto } from '@mettig/shared';
import { TStatus } from 'src/types';
import { BOOKINGS_PAGE_SIZE_OPTIONS, PERIOD_TABS, STATUS_TABS } from './constants';
import { WalkInModal } from './components/walk-in-modal';
import { ChatModal } from './components/chat-modal';
import { BookingCard } from './components/booking-card';
import { ConfirmationModal } from './components/confirmation-modal';
import { EmptyState } from './components/empty-state';
import { LoadingState } from './components/loading-state';
import { BusinessBookingsResponseDto, TBookingsPeriod } from './types';
import styles from './index.module.scss';
import { ConfirmationModalState } from './components/confirmation-modal/types';

const EMPTY_BOOKINGS: BusinessBookingItemDto[] = [];

export const BookingsPage = (): React.JSX.Element => {
  const [status, setStatus] = useState<TStatus>('all');
  const [period, setPeriod] = useState<TBookingsPeriod>('today');
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [walkInOpened, setWalkInOpened] = useState(false);
  const [chatBooking, setChatBooking] = useState<BusinessBookingItemDto | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [confirmation, setConfirmation] = useState<ConfirmationModalState | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    bookingId: string;
    status: 'completed' | 'cancelled';
  } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['business-bookings', period, status, limit, offset],
    queryFn: async () => {
      const { data } = await apiClient.get<BusinessBookingsResponseDto>('/business/bookings', {
        params: {
          period,
          status: status === 'all' ? undefined : status,
          limit,
          offset,
        },
      });

      return data;
    },
  });

  const totalBookings = data?.total ?? 0;
  const pagedBookings = data?.bookings ?? EMPTY_BOOKINGS;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalBookings / limit);

  useEffect(() => {
    setOffset(0);
  }, [period, status, limit]);

  const confirmedBookings = useMemo(
    () => pagedBookings.filter((booking) => booking.status === 'confirmed'),
    [pagedBookings],
  );

  useEffect(() => {
    if (confirmedBookings.length === 0) {
      setUnreadCounts((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }

    let isCancelled = false;

    const loadUnreadCounts = async () => {
      const results = await Promise.allSettled(
        confirmedBookings.map((booking) =>
          apiClient
            .get<ChatUnreadCountDto>(`/bookings/${booking.id}/messages/unread`)
            .then((response) => ({
              id: booking.id,
              count: response.data.unread_count,
            })),
        ),
      );

      if (isCancelled) return;

      const nextCounts: Record<string, number> = {};
      for (const result of results) {
        if (result.status === 'fulfilled') {
          nextCounts[result.value.id] = result.value.count;
        }
      }

      setUnreadCounts(nextCounts);
    };

    void loadUnreadCounts();

    return () => {
      isCancelled = true;
    };
  }, [confirmedBookings]);

  const updateBookingStatusMutation = useMutation({
    mutationFn: async ({
      bookingId,
      nextStatus,
    }: {
      bookingId: string;
      nextStatus: 'completed' | 'cancelled';
    }) => {
      await apiClient.patch(`/business/bookings/${bookingId}`, { status: nextStatus });
    },
    onSettled: async () => {
      setPendingAction(null);
      setOffset(0);
      await queryClient.invalidateQueries({ queryKey: ['business-bookings'] });
    },
  });

  const handleCreated = () => {
    setOffset(0);
    void queryClient.invalidateQueries({ queryKey: ['business-bookings'] });
  };

  const handleCompleteBooking = (booking: BusinessBookingItemDto) => {
    setConfirmation({ booking, action: 'completed' });
  };

  const handleCancelBooking = (booking: BusinessBookingItemDto) => {
    setConfirmation({ booking, action: 'cancelled' });
  };

  const handleCloseConfirmation = () => {
    if (updateBookingStatusMutation.isPending) return;
    setConfirmation(null);
  };

  const handleConfirmStatusChange = () => {
    if (!confirmation) return;

    setPendingAction({
      bookingId: confirmation.booking.id,
      status: confirmation.action,
    });

    updateBookingStatusMutation.mutate(
      {
        bookingId: confirmation.booking.id,
        nextStatus: confirmation.action,
      },
      {
        onSettled: async () => {
          setConfirmation(null);
          setPendingAction(null);
          setOffset(0);
          await queryClient.invalidateQueries({ queryKey: ['business-bookings'] });
        },
      },
    );
  };

  const handlePageChange = (page: number) => {
    setOffset((page - 1) * limit);
  };

  const isEmpty = pagedBookings.length === 0;

  const bookingCards = pagedBookings.map((booking) => (
    <BookingCard
      key={booking.id}
      booking={booking}
      unreadCount={unreadCounts[booking.id] ?? 0}
      onOpenChat={setChatBooking}
      onComplete={handleCompleteBooking}
      onCancel={handleCancelBooking}
      isCompleting={
        updateBookingStatusMutation.isPending &&
        pendingAction?.bookingId === booking.id &&
        pendingAction.status === 'completed'
      }
      isCancelling={
        updateBookingStatusMutation.isPending &&
        pendingAction?.bookingId === booking.id &&
        pendingAction.status === 'cancelled'
      }
    />
  ));

  return (
    <div className={styles.bookingsPage}>
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs">
          <Title order={1}>Записи</Title>
          <Text c="dimmed">Управление записями клиентов</Text>
        </Stack>
        <Button color="teal" onClick={() => setWalkInOpened(true)} style={{ marginTop: 4 }}>
          + Клиент
        </Button>
      </Group>

      <Tabs
        variant="pills"
        color="#191a2d"
        value={period}
        onChange={(value) => setPeriod((value as TBookingsPeriod) ?? 'today')}
        keepMounted={false}
      >
        <Tabs.List>
          {PERIOD_TABS.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Tabs
        variant="pills"
        color="#191a2d"
        value={status}
        onChange={(value) => setStatus((value as TStatus) ?? 'all')}
        keepMounted={false}
      >
        <Tabs.List>
          {STATUS_TABS.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Group justify="space-between" align="end">
        <Text size="sm" c="dimmed">
          Показано {pagedBookings.length} из {totalBookings}
        </Text>
        <Select
          label="Показывать"
          data={BOOKINGS_PAGE_SIZE_OPTIONS}
          value={String(limit)}
          onChange={(value) => setLimit(Number(value ?? '10'))}
          allowDeselect={false}
          w={140}
        />
      </Group>
      {isEmpty && isLoading && <LoadingState />}
      {isEmpty && !isLoading && <EmptyState />}

      {!isEmpty && !isLoading && (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="lg">
            {bookingCards}
          </SimpleGrid>

          {totalPages > 1 && (
            <Group justify="center">
              <Pagination
                value={currentPage}
                onChange={handlePageChange}
                total={totalPages}
                withEdges
                siblings={1}
                color="#191a2d"
                disabled={isFetching}
              />
            </Group>
          )}
        </Stack>
      )}

      <WalkInModal
        opened={walkInOpened}
        onClose={() => setWalkInOpened(false)}
        onCreated={handleCreated}
      />

      <ConfirmationModal
        confirmation={confirmation}
        isSubmitting={updateBookingStatusMutation.isPending}
        onClose={handleCloseConfirmation}
        onConfirm={handleConfirmStatusChange}
      />

      <ChatModal booking={chatBooking} onClose={() => setChatBooking(null)} />
    </div>
  );
};
