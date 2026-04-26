import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiClient } from '@mettig/shared';
import { trackEvent } from '@mettig/shared/src/utils/track-event';
import type { StatsStackScreenProps } from '../../navigation/types';

// ─── API types ────────────────────────────────────────────────────────────────

type ClientSegment = 'regulars' | 'sleeping' | 'lost' | 'not_visited' | 'new';

interface ClientSegmentCounts {
  regulars: number;
  sleeping: number;
  lost: number;
  not_visited: number;
  new: number;
  total: number;
}

interface ClientListItem {
  id: string;
  name: string | null;
  phone: string | null;
  segment: ClientSegment;
  total_visits: number;
  total_revenue: number;
  first_visit_at: string | null;
  last_visit_at: string | null;
}

interface ClientListResult {
  clients: ClientListItem[];
  next_cursor: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

interface SegmentMeta {
  key: ClientSegment;
  label: string;
  description: string;
  color: string;
  emoji: string;
}

const SEGMENTS: SegmentMeta[] = [
  {
    key: 'regulars',
    label: 'Постоянные',
    description: '≥2 визита за 90 дней',
    color: '#1D6B4F',
    emoji: '⭐',
  },
  {
    key: 'sleeping',
    label: 'Спящие',
    description: 'Не были 30–180 дней',
    color: '#B07415',
    emoji: '😴',
  },
  {
    key: 'lost',
    label: 'Пропавшие',
    description: 'Не были более 180 дней',
    color: '#C4462A',
    emoji: '👻',
  },
  {
    key: 'not_visited',
    label: 'Не посещали',
    description: 'Записи без визита',
    color: '#8A8A86',
    emoji: '🔇',
  },
  {
    key: 'new',
    label: 'Новые',
    description: 'Первый визит до 30 дней',
    color: '#2563EB',
    emoji: '✨',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitial(name: string | null): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBlock({ height }: { height: number }): React.JSX.Element {
  return (
    <View style={{ height, borderRadius: 12, backgroundColor: '#E8E8E4', marginBottom: 10 }} />
  );
}

function ClientRowSkeleton(): React.JSX.Element {
  return (
    <View style={styles.clientRow}>
      <View style={[styles.avatar, { backgroundColor: '#E8E8E4' }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ height: 14, width: '60%', borderRadius: 6, backgroundColor: '#E8E8E4' }} />
        <View style={{ height: 11, width: '35%', borderRadius: 6, backgroundColor: '#F0F0EE' }} />
      </View>
    </View>
  );
}

// ─── SegmentCard ──────────────────────────────────────────────────────────────

interface SegmentCardProps {
  meta: SegmentMeta;
  count: number;
  isActive: boolean;
  onPress: () => void;
}

function SegmentCard({ meta, count, isActive, onPress }: SegmentCardProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[styles.segmentCard, isActive && { borderColor: meta.color, borderWidth: 2 }]}
      onPress={onPress}
      accessibilityLabel={`Сегмент ${meta.label}: ${count}`}
    >
      <Text style={styles.segmentCardEmoji}>{meta.emoji}</Text>
      <Text style={[styles.segmentCardCount, { color: meta.color }]}>{count}</Text>
      <Text style={styles.segmentCardLabel}>{meta.label}</Text>
      <Text style={styles.segmentCardDesc}>{meta.description}</Text>
    </TouchableOpacity>
  );
}

// ─── ActionCard ───────────────────────────────────────────────────────────────

function ActionCard({
  emoji,
  title,
  subtitle,
  onPress,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} accessibilityLabel={title}>
      <Text style={styles.actionCardEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionCardTitle}>{title}</Text>
        <Text style={styles.actionCardSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.actionCardArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── ClientRow ────────────────────────────────────────────────────────────────

interface ClientRowProps {
  item: ClientListItem;
  onPress: (item: ClientListItem) => void;
}

function ClientRow({ item, onPress }: ClientRowProps): React.JSX.Element {
  const displayName = item.name ?? 'Аноним';
  const initial = getInitial(item.name);
  const seg = SEGMENTS.find((s) => s.key === item.segment);
  const avatarColor = seg?.color ?? '#8A8A86';

  return (
    <TouchableOpacity
      style={styles.clientRow}
      onPress={() => onPress(item)}
      accessibilityLabel={`Клиент ${displayName}`}
    >
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.clientName}>{displayName}</Text>
        <Text style={styles.clientMeta}>{item.total_visits} визитов</Text>
      </View>
      <Text style={styles.clientArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── ClientsScreen ────────────────────────────────────────────────────────────

type Props = StatsStackScreenProps<'ClientsScreen'>;

export function ClientsScreen({ route, navigation }: Props): React.JSX.Element {
  const initialSegment = route.params?.segment as ClientSegment | undefined;
  const [activeSegment, setActiveSegment] = useState<ClientSegment | undefined>(initialSegment);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track screen open
  useEffect(() => {
    void trackEvent({ event_type: 'clients_screen_opened' });
  }, []);

  // Debounce search input
  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 300);
  }, []);

  // Segment counts
  const { data: segmentsData, isLoading: segmentsLoading } = useQuery({
    queryKey: ['client-segments'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ segments: ClientSegmentCounts }>(
        '/business/clients/segments',
      );
      return data.segments;
    },
    staleTime: 60_000,
  });

  // Clients list with infinite scroll
  const {
    data: clientsPages,
    isLoading: clientsLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['business-clients', activeSegment, debouncedSearch],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: '20' };
      if (activeSegment) params['segment'] = activeSegment;
      if (debouncedSearch.trim()) params['search'] = debouncedSearch.trim();
      if (typeof pageParam === 'string') params['cursor'] = pageParam;
      const { data } = await apiClient.get<ClientListResult>('/business/clients', { params });
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    staleTime: 30_000,
  });

  const clients = clientsPages?.pages.flatMap((p) => p.clients) ?? [];

  const handleSegmentPress = useCallback(
    (key: ClientSegment) => {
      const next = activeSegment === key ? undefined : key;
      setActiveSegment(next);
      if (next) {
        void trackEvent({ event_type: 'client_segment_filtered', payload: { segment: next } });
      }
    },
    [activeSegment],
  );

  const handleClientPress = useCallback(
    (item: ClientListItem) => {
      void trackEvent({ event_type: 'client_card_opened', payload: { client_id: item.id } });
      navigation.navigate('ClientCardScreen', { clientId: item.id, clientName: item.name });
    },
    [navigation],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const total = segmentsData?.total ?? 0;

  // ── Render header ──────────────────────────────────────────────────────────

  const ListHeader = (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Назад"
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Клиенты{total > 0 ? ` ${total}` : ''}
        </Text>
      </View>

      {/* Segment grid */}
      {segmentsLoading ? (
        <View style={styles.gridSkeleton}>
          <SkeletonBlock height={96} />
        </View>
      ) : (
        <View style={styles.segmentGrid}>
          {SEGMENTS.map((meta) => (
            <SegmentCard
              key={meta.key}
              meta={meta}
              count={segmentsData?.[meta.key] ?? 0}
              isActive={activeSegment === meta.key}
              onPress={() => handleSegmentPress(meta.key)}
            />
          ))}
        </View>
      )}

      {/* Action cards */}
      <View style={styles.actionCardsRow}>
        <ActionCard
          emoji="🔄"
          title="Возвращаемость"
          subtitle="% клиентов возвращается"
          onPress={() => navigation.navigate('ReturnRateScreen')}
        />
        <ActionCard
          emoji="📢"
          title="Рассылки"
          subtitle="Push-уведомления клиентам"
          onPress={() => navigation.navigate('BroadcastsScreen')}
        />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по имени или телефону"
          placeholderTextColor="#B0B0A8"
          value={search}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          accessibilityLabel="Поиск клиентов"
        />
      </View>

      {/* Segment filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        <TouchableOpacity
          style={[styles.chip, activeSegment === undefined && styles.chipActive]}
          onPress={() => setActiveSegment(undefined)}
          accessibilityLabel="Все клиенты"
        >
          <Text style={[styles.chipText, activeSegment === undefined && styles.chipTextActive]}>
            Все
          </Text>
        </TouchableOpacity>
        {SEGMENTS.map((meta) => (
          <TouchableOpacity
            key={meta.key}
            style={[styles.chip, activeSegment === meta.key && styles.chipActive]}
            onPress={() => handleSegmentPress(meta.key)}
            accessibilityLabel={`Фильтр ${meta.label}`}
          >
            <Text
              style={[styles.chipText, activeSegment === meta.key && styles.chipTextActive]}
            >
              {meta.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Section title */}
      <Text style={styles.listSectionTitle}>Список клиентов</Text>
    </View>
  );

  const ListEmpty = clientsLoading ? (
    <View>
      {Array.from({ length: 6 }).map((_, i) => (
        <ClientRowSkeleton key={i} />
      ))}
    </View>
  ) : (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>👤</Text>
      <Text style={styles.emptyTitle}>Клиентов нет</Text>
      <Text style={styles.emptyHint}>
        {activeSegment || debouncedSearch
          ? 'Нет клиентов по выбранному фильтру'
          : 'Записи появятся после первых визитов'}
      </Text>
    </View>
  );

  const ListFooter =
    isFetchingNextPage ? (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#1D6B4F" />
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={clients}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ClientRow item={item} onPress={handleClientPress} />}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A18',
  },
  gridSkeleton: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  segmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  segmentCard: {
    width: '30.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    padding: 10,
    alignItems: 'center',
    gap: 2,
  },
  segmentCardEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  segmentCardCount: {
    fontSize: 20,
    fontWeight: '700',
  },
  segmentCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1A1A18',
    textAlign: 'center',
  },
  segmentCardDesc: {
    fontSize: 9,
    color: '#8A8A86',
    textAlign: 'center',
    marginTop: 1,
  },
  actionCardsRow: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionCardEmoji: {
    fontSize: 24,
  },
  actionCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A18',
  },
  actionCardSubtitle: {
    fontSize: 12,
    color: '#8A8A86',
    marginTop: 1,
  },
  actionCardArrow: {
    fontSize: 22,
    color: '#B0B0A8',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: '#F5F5F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1A18',
  },
  chipsRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F5F5F2',
    borderWidth: 1,
    borderColor: '#E8E8E4',
  },
  chipActive: {
    backgroundColor: '#1D6B4F',
    borderColor: '#1D6B4F',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5C5C58',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  listSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A8A86',
    paddingHorizontal: 16,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0EE',
    gap: 12,
    backgroundColor: '#FAFAF8',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clientName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A18',
  },
  clientMeta: {
    fontSize: 12,
    color: '#8A8A86',
    marginTop: 2,
  },
  clientArrow: {
    fontSize: 22,
    color: '#B0B0A8',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A18',
    marginBottom: 6,
  },
  emptyHint: {
    fontSize: 14,
    color: '#8A8A86',
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
