import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, trackEvent, type BusinessBookingItemDto, type ServiceItemDto, type StaffItemDto, type ChatMessageDto, type ChatMessagesResponseDto, type ChatUnreadCountDto } from '@mettig/shared';
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

// ─── ChatModal ────────────────────────────────────────────────────────────────

interface ChatModalProps {
  booking: BusinessBookingItemDto | null;
  onClose: () => void;
}

const POLL_INTERVAL_MS = 5000;

function ChatModal({ booking, onClose }: ChatModalProps): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCursorRef = useRef<string | null>(null);

  const isReadOnly = booking?.status !== 'confirmed';

  const fetchMessages = useCallback(async (initial = false) => {
    if (!booking) return;
    try {
      const params: Record<string, string> = { limit: '50' };
      if (!initial && lastCursorRef.current) params['cursor'] = lastCursorRef.current;
      const res = await apiClient.get<ChatMessagesResponseDto>(
        `/bookings/${booking.id}/messages`,
        { params },
      );
      const { messages: incoming, next_cursor } = res.data;
      if (initial) {
        setMessages(incoming);
      } else if (incoming.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newOnes = incoming.filter((m) => !existingIds.has(m.id));
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });
      }
      if (next_cursor) lastCursorRef.current = next_cursor;
    } catch {
      // silent
    } finally {
      if (initial) setIsLoading(false);
    }
  }, [booking]);

  useEffect(() => {
    if (!booking) return;
    setMessages([]);
    setIsLoading(true);
    lastCursorRef.current = null;
    setText('');
    setSendError(null);

    void fetchMessages(true);
    void apiClient.patch(`/bookings/${booking.id}/messages/read`).catch(() => {});
    void trackEvent({ event_type: 'chat_opened', payload: { booking_id: booking.id, sender_role: 'staff' } });

    pollTimerRef.current = setInterval(() => {
      void fetchMessages(false);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [booking, fetchMessages]);

  useEffect(() => {
    if (messages.length > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!booking) return;
    const content = text.trim();
    if (!content || isSending) return;

    setText('');
    setSendError(null);
    setIsSending(true);
    try {
      const res = await apiClient.post<ChatMessageDto>(`/bookings/${booking.id}/messages`, {
        message_type: 'text',
        content,
      });
      setMessages((prev) => [...prev, res.data]);
      void trackEvent({
        event_type: 'chat_message_sent',
        payload: { booking_id: booking.id, message_type: 'text', sender_role: 'staff' },
      });
    } catch {
      setSendError('Не удалось отправить сообщение');
      setText(content);
    } finally {
      setIsSending(false);
    }
  };

  const formatMsgTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      opened={Boolean(booking)}
      onClose={onClose}
      title={`Чат: ${booking?.client_name ?? 'Клиент'}`}
      size="lg"
      centered
    >
      {isLoading ? (
        <Stack align="center" py="xl">
          <Loader size="sm" />
        </Stack>
      ) : (
        <Stack gap="md">
          {/* Messages */}
          <ScrollArea
            h={400}
            viewportRef={scrollRef as React.RefObject<HTMLDivElement>}
            styles={{ viewport: { display: 'flex', flexDirection: 'column' } }}
          >
            {messages.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">Нет сообщений</Text>
            ) : (
              <Stack gap={4} p="xs">
                {messages.map((msg) => {
                  const isOwn = msg.sender_role === 'staff';
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '70%',
                          backgroundColor: isOwn ? '#1D6B4F' : '#F5F5F2',
                          color: isOwn ? '#fff' : '#1A1A18',
                          borderRadius: 12,
                          borderBottomRightRadius: isOwn ? 2 : 12,
                          borderBottomLeftRadius: isOwn ? 12 : 2,
                          padding: '8px 12px',
                        }}
                      >
                        {msg.message_type === 'image' ? (
                          <img
                            src={msg.content}
                            alt="фото"
                            style={{ maxWidth: 220, borderRadius: 8, display: 'block' }}
                          />
                        ) : (
                          <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {msg.content}
                          </Text>
                        )}
                        <Text size="xs" style={{ opacity: 0.6, marginTop: 2, textAlign: 'right' }}>
                          {formatMsgTime(msg.created_at)}
                        </Text>
                      </div>
                    </div>
                  );
                })}
              </Stack>
            )}
          </ScrollArea>

          {/* Error */}
          {sendError && (
            <Text size="sm" c="red">{sendError}</Text>
          )}

          {/* Input */}
          {isReadOnly ? (
            <Card withBorder radius="md" padding="sm" bg="gray.0">
              <Text size="sm" c="dimmed" ta="center">
                💬 Запись завершена — чат только для просмотра
              </Text>
            </Card>
          ) : (
            <Group gap="sm" align="flex-end">
              <Textarea
                style={{ flex: 1 }}
                placeholder="Сообщение..."
                value={text}
                onChange={(e) => setText(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                autosize
                minRows={1}
                maxRows={4}
                maxLength={2000}
                disabled={isSending}
              />
              <Button
                color="teal"
                onClick={() => void handleSend()}
                loading={isSending}
                disabled={!text.trim()}
              >
                →
              </Button>
            </Group>
          )}
        </Stack>
      )}
    </Modal>
  );
}

// ─── BookingsPage ─────────────────────────────────────────────────────────────

export const BookingsPage = () => {
  const [status, setStatus] = useState<TStatus>('all');
  const [walkInOpened, setWalkInOpened] = useState(false);
  const [chatBooking, setChatBooking] = useState<BusinessBookingItemDto | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
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

  // Load unread counts for confirmed bookings
  useEffect(() => {
    const confirmed = bookings.filter((b) => b.status === 'confirmed');
    if (confirmed.length === 0) return;
    void (async () => {
      const results = await Promise.allSettled(
        confirmed.map((b) =>
          apiClient
            .get<ChatUnreadCountDto>(`/bookings/${b.id}/messages/unread`)
            .then((r) => ({ id: b.id, count: r.data.unread_count })),
        ),
      );
      const counts: Record<string, number> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') counts[r.value.id] = r.value.count;
      }
      setUnreadCounts(counts);
    })();
  }, [bookings]);

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

                  {booking.status === 'confirmed' && (
                    <Button
                      variant="light"
                      color="teal"
                      fullWidth
                      onClick={() => setChatBooking(booking)}
                      rightSection={
                        (unreadCounts[booking.id] ?? 0) > 0 ? (
                          <Badge color="red" size="sm" circle>
                            {(unreadCounts[booking.id] ?? 0) > 99 ? '99+' : (unreadCounts[booking.id] ?? 0)}
                          </Badge>
                        ) : undefined
                      }
                    >
                      💬 Чат с клиентом
                    </Button>
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

      <ChatModal
        booking={chatBooking}
        onClose={() => setChatBooking(null)}
      />
    </div>
  );
};
