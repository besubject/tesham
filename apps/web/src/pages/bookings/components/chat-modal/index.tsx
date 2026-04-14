import {
  Modal,
  Stack,
  Loader,
  ScrollArea,
  Card,
  Group,
  Textarea,
  Button,
  Text,
} from '@mantine/core';
import {
  BusinessBookingItemDto,
  ChatMessageDto,
  apiClient,
  ChatMessagesResponseDto,
  trackEvent,
} from '@mettig/shared';
import { useState, useRef, useCallback, useEffect } from 'react';

interface ChatModalProps {
  booking: BusinessBookingItemDto | null;
  onClose: () => void;
}

const POLL_INTERVAL_MS = 5000;

export const ChatModal = ({ booking, onClose }: ChatModalProps) => {
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCursorRef = useRef<string | null>(null);

  const isReadOnly = booking?.status !== 'confirmed';

  const fetchMessages = useCallback(
    async (initial = false) => {
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
    },
    [booking],
  );

  useEffect(() => {
    if (!booking) return;
    setMessages([]);
    setIsLoading(true);
    lastCursorRef.current = null;
    setText('');
    setSendError(null);

    void fetchMessages(true);
    void apiClient.patch(`/bookings/${booking.id}/messages/read`).catch(() => {});
    void trackEvent({
      event_type: 'chat_opened',
      payload: { booking_id: booking.id, sender_role: 'staff' },
    });

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
              <Text c="dimmed" ta="center" py="xl">
                Нет сообщений
              </Text>
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
                          <Text
                            size="sm"
                            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                          >
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
            <Text size="sm" c="red">
              {sendError}
            </Text>
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
};
