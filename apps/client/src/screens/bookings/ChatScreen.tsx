import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { apiClient, borderRadius, colors, monoFont, spacing, trackEvent, typography } from '@mettig/shared';
import type { ChatMessageDto, ChatMessagesResponseDto } from '@mettig/shared';
import type { BookingsStackScreenProps } from '../../navigation/types';
import { uploadPhoto } from '../../utils/photo-upload';

type Props = BookingsStackScreenProps<'Chat'>;

const POLL_INTERVAL_MS = 5000;

// ─── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessageDto }): React.JSX.Element {
  const isOwn = message.sender_role === 'client';

  return (
    <View style={[bubbleStyles.row, isOwn ? bubbleStyles.rowRight : bubbleStyles.rowLeft]}>
      <View style={[bubbleStyles.bubble, isOwn ? bubbleStyles.bubbleOwn : bubbleStyles.bubbleOther]}>
        {message.message_type === 'image' ? (
          <Image
            source={{ uri: message.content }}
            style={bubbleStyles.image}
            resizeMode="cover"
          />
        ) : (
          <Text style={[bubbleStyles.text, isOwn ? bubbleStyles.textOwn : bubbleStyles.textOther]}>
            {message.content}
          </Text>
        )}
        <Text style={[bubbleStyles.time, isOwn ? bubbleStyles.timeOwn : bubbleStyles.timeOther]}>
          {formatTime(message.created_at)}
        </Text>
      </View>
    </View>
  );
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

const bubbleStyles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs / 2,
  },
  rowRight: { alignItems: 'flex-end' },
  rowLeft: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 14,
    padding: spacing.sm + 2,
    borderWidth: 1,
  },
  bubbleOwn: {
    backgroundColor: colors.text,         // ink
    borderColor: colors.text,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  text: { fontSize: 13, lineHeight: 19 },
  textOwn: { color: colors.surface },
  textOther: { color: colors.text },
  image: { width: 220, height: 180, borderRadius: borderRadius.sm },
  time: {
    fontFamily: monoFont,
    fontSize: 9,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  timeOwn: { color: 'rgba(251,250,246,0.55)', textAlign: 'right' },
  timeOther: { color: colors.textMuted },
});

// ─── ChatScreen ────────────────────────────────────────────────────────────────

export function ChatScreen({ route, navigation }: Props): React.JSX.Element {
  const { bookingId, businessName, staffName, isReadOnly } = route.params;
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList<ChatMessageDto>>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCursorRef = useRef<string | null>(null);

  // ── Fetch messages ──────────────────────────────────────────────────────

  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const params: Record<string, string> = { limit: '50' };
      if (!initial && lastCursorRef.current) {
        params['cursor'] = lastCursorRef.current;
      }
      const res = await apiClient.get<ChatMessagesResponseDto>(
        `/bookings/${bookingId}/messages`,
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
      if (next_cursor) {
        lastCursorRef.current = next_cursor;
      }
    } catch {
      // silent — keep existing messages
    } finally {
      if (initial) setIsLoading(false);
    }
  }, [bookingId]);

  // ── Mark as read ────────────────────────────────────────────────────────

  const markAsRead = useCallback(async () => {
    try {
      await apiClient.patch(`/bookings/${bookingId}/messages/read`);
    } catch {
      // silent
    }
  }, [bookingId]);

  // ── Lifecycle ───────────────────────────────────────────────────────────

  useEffect(() => {
    void fetchMessages(true);
    void markAsRead();

    // Track chat opened
    void trackEvent({
      event_type: 'chat_opened',
      payload: { booking_id: bookingId },
    });

    // Start polling
    pollTimerRef.current = setInterval(() => {
      void fetchMessages(false);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [fetchMessages, markAsRead, bookingId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages.length]);

  // ── Send text ───────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content || isSending) return;

    setText('');
    setSendError(null);
    setIsSending(true);
    try {
      const res = await apiClient.post<ChatMessageDto>(`/bookings/${bookingId}/messages`, {
        message_type: 'text',
        content,
      });
      setMessages((prev) => [...prev, res.data]);
      void trackEvent({
        event_type: 'chat_message_sent',
        payload: { booking_id: bookingId, message_type: 'text' },
      });
    } catch {
      setSendError('Не удалось отправить сообщение');
      setText(content);
    } finally {
      setIsSending(false);
    }
  }, [text, isSending, bookingId]);

  // ── Send photo ──────────────────────────────────────────────────────────

  const handlePickPhoto = useCallback(async () => {
    if (isUploadingPhoto || isSending) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    if (!asset) return;

    setSendError(null);
    setIsUploadingPhoto(true);
    try {
      const fileName = asset.fileName ?? `chat_${Date.now()}.jpg`;
      const publicUrl = await uploadPhoto(asset.uri, 'photo', fileName);
      const res = await apiClient.post<ChatMessageDto>(`/bookings/${bookingId}/messages`, {
        message_type: 'image',
        content: publicUrl,
      });
      setMessages((prev) => [...prev, res.data]);
      void trackEvent({
        event_type: 'chat_message_sent',
        payload: { booking_id: bookingId, message_type: 'image' },
      });
    } catch {
      setSendError('Не удалось загрузить фото');
    } finally {
      setIsUploadingPhoto(false);
    }
  }, [isUploadingPhoto, isSending, bookingId]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {businessName}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {staffName}
          </Text>
        </View>
      </View>

      {/* Loading */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <>
          {/* Messages list */}
          <FlatList<ChatMessageDto>
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: spacing.sm },
            ]}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Начните переписку с мастером</Text>
              </View>
            }
          />

          {/* Error */}
          {sendError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{sendError}</Text>
            </View>
          )}

          {/* Read-only footer */}
          {isReadOnly ? (
            <View style={[styles.readOnlyBanner, { paddingBottom: insets.bottom + spacing.sm }]}>
              <Text style={styles.readOnlyText}>💬 Чат завершён</Text>
              <Text style={styles.readOnlyHint}>
                Запись завершена. Чат доступен только для просмотра.
              </Text>
            </View>
          ) : (
            /* Input bar */
            <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.xs }]}>
              <TouchableOpacity
                style={styles.photoBtn}
                onPress={() => void handlePickPhoto()}
                disabled={isUploadingPhoto || isSending}
                activeOpacity={0.7}
                accessibilityLabel="Отправить фото"
              >
                {isUploadingPhoto ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={styles.photoBtnIcon}>📷</Text>
                )}
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder="Сообщение..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={2000}
                editable={!isSending}
                returnKeyType="default"
              />

              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!text.trim() || isSending) && styles.sendBtnDisabled,
                ]}
                onPress={() => void handleSend()}
                disabled={!text.trim() || isSending}
                activeOpacity={0.7}
                accessibilityLabel="Отправить сообщение"
              >
                {isSending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.sendBtnText}>→</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    gap: spacing.sm,
  },
  backBtn: { paddingVertical: spacing.xs },
  backText: { fontSize: 20, color: colors.text, lineHeight: 24 },
  headerTitles: { flex: 1 },
  headerTitle: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 18 },
  headerSubtitle: { fontFamily: monoFont, fontSize: 9, color: colors.ok, letterSpacing: 0.4, marginTop: 2 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingTop: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
    marginTop: spacing.xxxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: colors.errorLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
  },
  readOnlyBanner: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  readOnlyText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  readOnlyHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
    gap: spacing.sm,
  },
  photoBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  photoBtnIcon: { fontSize: 18, lineHeight: 22 },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    fontSize: 13,
    color: colors.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.text,
  },
  sendBtnDisabled: { backgroundColor: colors.border },
  sendBtnText: { color: colors.surface, fontSize: 16, fontWeight: '700' },
});
