import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiClient } from '@mettig/shared';
import type { StatsStackScreenProps } from '../../navigation/types';

// ─── API types ────────────────────────────────────────────────────────────────

type ClientSegment = 'regulars' | 'sleeping' | 'lost' | 'not_visited' | 'new';

interface BookingHistoryItem {
  id: string;
  slot_date: string;
  slot_time: string;
  service_name: string;
  service_price: number;
  staff_name: string;
  status: string;
  source: string;
  created_at: string;
}

interface ClientCard {
  id: string;
  name: string | null;
  phone: string | null;
  segment: ClientSegment;
  total_visits: number;
  total_revenue: number;
  first_visit_at: string | null;
  last_visit_at: string | null;
  bookings: BookingHistoryItem[];
  next_cursor: string | null;
}

interface ClientCardResponse {
  client: ClientCard;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGMENT_LABELS: Record<ClientSegment, string> = {
  regulars: 'Постоянный',
  sleeping: 'Спящий',
  lost: 'Пропавший',
  not_visited: 'Не посещал',
  new: 'Новый',
};

const SEGMENT_COLORS: Record<ClientSegment, string> = {
  regulars: '#1D6B4F',
  sleeping: '#B07415',
  lost: '#C4462A',
  not_visited: '#8A8A86',
  new: '#2563EB',
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Подтверждена',
  completed: 'Выполнена',
  cancelled: 'Отменена',
  no_show: 'Не пришёл',
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#1D6B4F',
  completed: '#2563EB',
  cancelled: '#8A8A86',
  no_show: '#D97706',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function formatPrice(price: number): string {
  return `${price.toLocaleString('ru-RU')} ₽`;
}

function getInitial(name: string | null): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBlock({ height }: { height: number }): React.JSX.Element {
  return (
    <View
      style={{
        height,
        borderRadius: 8,
        backgroundColor: '#E8E8E4',
        marginBottom: 8,
      }}
    />
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

// ─── BookingRow ───────────────────────────────────────────────────────────────

interface BookingRowProps {
  item: BookingHistoryItem;
  onPress: (bookingId: string) => void;
}

function BookingRow({ item, onPress }: BookingRowProps): React.JSX.Element {
  const statusColor = STATUS_COLORS[item.status] ?? '#8A8A86';
  const statusLabel = STATUS_LABELS[item.status] ?? item.status;

  return (
    <TouchableOpacity
      style={styles.bookingRow}
      onPress={() => onPress(item.id)}
      accessibilityLabel={`Запись ${item.service_name} ${formatDate(item.slot_date)}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.bookingService}>{item.service_name}</Text>
        <Text style={styles.bookingMeta}>
          {formatDate(item.slot_date)} в {formatTime(item.slot_time)} · {item.staff_name}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={styles.bookingPrice}>{formatPrice(item.service_price)}</Text>
        <Text style={[styles.bookingStatus, { color: statusColor }]}>{statusLabel}</Text>
      </View>
      <Text style={styles.bookingArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── ClientCardScreen ─────────────────────────────────────────────────────────

type Props = StatsStackScreenProps<'ClientCardScreen'>;

export function ClientCardScreen({ route, navigation }: Props): React.JSX.Element {
  const { clientId, clientName } = route.params;

  // First page (includes client meta + first 20 bookings)
  const { data: cardData, isLoading: cardLoading, error } = useQuery({
    queryKey: ['client-card', clientId],
    queryFn: async () => {
      const { data } = await apiClient.get<ClientCardResponse>(`/business/clients/${clientId}`);
      return data.client;
    },
    staleTime: 60_000,
  });

  // Additional booking pages
  const {
    data: morePages,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['client-card-bookings', clientId],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = {};
      if (typeof pageParam === 'string') params['booking_cursor'] = pageParam;
      const { data } = await apiClient.get<ClientCardResponse>(
        `/business/clients/${clientId}`,
        { params },
      );
      return data.client;
    },
    initialPageParam: cardData?.next_cursor as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!cardData?.next_cursor,
    staleTime: 60_000,
  });

  // Merge bookings: first page + paginated extras
  const extraBookings = morePages?.pages.flatMap((p) => p.bookings) ?? [];
  const allBookings: BookingHistoryItem[] = [
    ...(cardData?.bookings ?? []),
    ...extraBookings,
  ];

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleBookingPress = useCallback(
    (bookingId: string) => {
      // Navigate to BookingDetails which is in the Bookings stack.
      // Switch to Bookings tab via the parent tab navigator.
      (navigation.getParent() as { navigate: (name: string, params: unknown) => void } | undefined)?.navigate(
        'Bookings',
        { screen: 'BookingDetails', params: { bookingId } },
      );
    },
    [navigation],
  );

  const client = cardData;
  const displayName = clientName ?? client?.name ?? 'Аноним';
  const segmentColor = client ? (SEGMENT_COLORS[client.segment] ?? '#8A8A86') : '#8A8A86';
  const segmentLabel = client ? SEGMENT_LABELS[client.segment] : '';

  // ── List header ────────────────────────────────────────────────────────────

  const ListHeader = (
    <View>
      {/* Nav header */}
      <View style={styles.navHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Назад"
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {displayName}
        </Text>
      </View>

      {cardLoading ? (
        <View style={styles.section}>
          <SkeletonBlock height={80} />
          <SkeletonBlock height={100} />
          <SkeletonBlock height={60} />
        </View>
      ) : error != null ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Не удалось загрузить клиента</Text>
        </View>
      ) : client != null ? (
        <>
          {/* Avatar + name + segment */}
          <View style={styles.profileSection}>
            <View style={[styles.bigAvatar, { backgroundColor: segmentColor }]}>
              <Text style={styles.bigAvatarText}>{getInitial(client.name)}</Text>
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={styles.profileName}>{displayName}</Text>
              {client.phone != null && (
                <Text style={styles.profilePhone}>{client.phone}</Text>
              )}
              <View style={[styles.segmentBadge, { backgroundColor: segmentColor + '20', borderColor: segmentColor }]}>
                <Text style={[styles.segmentBadgeText, { color: segmentColor }]}>
                  {segmentLabel}
                </Text>
              </View>
            </View>
          </View>

          {/* 4 metrics */}
          <View style={styles.metricsGrid}>
            <MetricCard label="Визитов" value={String(client.total_visits)} />
            <MetricCard
              label="Потрачено"
              value={client.total_revenue > 0 ? formatPrice(client.total_revenue) : '—'}
            />
            <MetricCard
              label="Первый визит"
              value={client.first_visit_at ? formatDate(client.first_visit_at) : '—'}
            />
            <MetricCard
              label="Последний визит"
              value={client.last_visit_at ? formatDate(client.last_visit_at) : '—'}
            />
          </View>

          {/* Bookings header */}
          <Text style={styles.bookingsTitle}>История записей</Text>
        </>
      ) : null}
    </View>
  );

  const ListEmpty =
    !cardLoading && !error ? (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>Нет записей</Text>
      </View>
    ) : null;

  const ListFooter = isFetchingNextPage ? (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="small" color="#1D6B4F" />
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={allBookings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BookingRow item={item} onPress={handleBookingPress} />
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  listContent: {
    paddingBottom: 80,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: '#1D6B4F',
    lineHeight: 32,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A18',
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  centered: {
    padding: 32,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#C4462A',
    textAlign: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 12,
  },
  bigAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigAvatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A18',
    textAlign: 'center',
  },
  profilePhone: {
    fontSize: 14,
    color: '#5C5C58',
  },
  segmentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  segmentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 20,
  },
  metricCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A18',
  },
  metricLabel: {
    fontSize: 11,
    color: '#8A8A86',
    textAlign: 'center',
  },
  bookingsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A8A86',
    paddingHorizontal: 16,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0EE',
    backgroundColor: '#FAFAF8',
    gap: 8,
  },
  bookingService: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A18',
  },
  bookingMeta: {
    fontSize: 12,
    color: '#8A8A86',
    marginTop: 2,
  },
  bookingPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A18',
  },
  bookingStatus: {
    fontSize: 11,
    fontWeight: '500',
  },
  bookingArrow: {
    fontSize: 20,
    color: '#B0B0A8',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 32,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    color: '#8A8A86',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
