import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  apiClient,
  BusinessCard,
  BusinessListItemDto,
  PaginatedResponseDto,
  SearchBar,
  colors,
  spacing,
  trackEvent,
  typography,
} from '@mettig/shared';
import * as Location from 'expo-location';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessListProps {
  categoryId?: string;
  showSortToggle?: boolean;
  onBusinessPress: (businessId: string) => void;
}

type SortMode = 'rating' | 'distance';

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SkeletonCard(): React.JSX.Element {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.image} />
      <View style={skeletonStyles.content}>
        <View style={[skeletonStyles.line, { width: '70%' }]} />
        <View style={[skeletonStyles.line, { width: '50%' }]} />
        <View style={[skeletonStyles.line, { width: '85%' }]} />
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  image: { width: '100%', height: 140, backgroundColor: colors.surfaceAlt },
  content: { padding: spacing.md, gap: spacing.sm },
  line: { height: 12, backgroundColor: colors.surfaceAlt, borderRadius: 4 },
});

// ─── BusinessList ─────────────────────────────────────────────────────────────

const LIMIT = 20;

export function BusinessList({
  categoryId,
  showSortToggle = false,
  onBusinessPress,
}: BusinessListProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sort, setSort] = useState<SortMode>('rating');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [businesses, setBusinesses] = useState<BusinessListItemDto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ── Поиск ─────────────────────────────────────────────────────────────────
  const handleSearchChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(text), 300);
  }, []);

  // ── Загрузка бизнесов ─────────────────────────────────────────────────────
  const fetchBusinesses = useCallback(
    async (
      p: number,
      q: string,
      catId: string | undefined,
      sortMode: SortMode,
      loc: { lat: number; lng: number } | null,
      append: boolean,
    ): Promise<void> => {
      const params: Record<string, string | number> = { page: p, limit: LIMIT, sort: sortMode };
      if (q) params['query'] = q;
      if (catId) params['category_id'] = catId;
      if (sortMode === 'distance' && loc) {
        params['lat'] = loc.lat;
        params['lng'] = loc.lng;
      }
      const res = await apiClient.get<PaginatedResponseDto<BusinessListItemDto>>(
        '/businesses',
        { params },
      );
      const { data, pagination } = res.data;
      setBusinesses((prev) => (append ? [...prev, ...data] : data));
      setHasMore(pagination.page * pagination.limit < pagination.total);
      setPage(p);
    },
    [],
  );

  useEffect(() => {
    setIsLoading(true);
    fetchBusinesses(1, debouncedQuery, categoryId, sort, location, false).finally(
      () => setIsLoading(false),
    );
    if (debouncedQuery.length > 0) {
      void trackEvent({ event_type: 'catalog_search', payload: { query: debouncedQuery } });
    }
  }, [debouncedQuery, categoryId, sort, location, fetchBusinesses]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchBusinesses(1, debouncedQuery, categoryId, sort, location, false).finally(
      () => setIsRefreshing(false),
    );
  }, [debouncedQuery, categoryId, sort, location, fetchBusinesses]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || isLoading) return;
    setIsLoadingMore(true);
    fetchBusinesses(page + 1, debouncedQuery, categoryId, sort, location, true).finally(
      () => setIsLoadingMore(false),
    );
  }, [isLoadingMore, hasMore, isLoading, page, debouncedQuery, categoryId, sort, location, fetchBusinesses]);

  // ── Переключение сортировки ───────────────────────────────────────────────
  const handleSortToggle = useCallback(
    async (mode: SortMode) => {
      if (mode === sort) return;

      if (mode === 'distance') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          void trackEvent({ event_type: 'catalog_geolocation_denied' });
          return;
        }
        void trackEvent({ event_type: 'catalog_geolocation_granted' });
        const pos = await Location.getCurrentPositionAsync({});
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }

      void trackEvent({
        event_type: 'catalog_sort_changed',
        payload: { sort: mode },
      });
      setSort(mode);
    },
    [sort],
  );

  // ── Рендер ────────────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: BusinessListItemDto }) => (
      <View style={styles.cardWrapper}>
        <BusinessCard business={item} onPress={() => onBusinessPress(item.id)} />
      </View>
    ),
    [onBusinessPress],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyText}>Ничего не найдено</Text>
        <Text style={styles.emptyHint}>Попробуйте изменить запрос</Text>
      </View>
    );
  }, [isLoading]);

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.accent} size="small" />
      </View>
    );
  }, [isLoadingMore]);

  const renderHeader = useCallback(() => {
    if (!showSortToggle) return null;
    return (
      <View style={styles.sortRow}>
        <TouchableOpacity
          style={[styles.sortBtn, sort === 'rating' && styles.sortBtnActive]}
          onPress={() => { void handleSortToggle('rating'); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.sortBtnText, sort === 'rating' && styles.sortBtnTextActive]}>
            По рейтингу
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, sort === 'distance' && styles.sortBtnActive]}
          onPress={() => { void handleSortToggle('distance'); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.sortBtnText, sort === 'distance' && styles.sortBtnTextActive]}>
            По расстоянию
          </Text>
        </TouchableOpacity>
      </View>
    );
  }, [showSortToggle, sort, handleSortToggle]);

  return (
    <View style={styles.container}>
      <View style={styles.searchWrapper}>
        <SearchBar
          value={query}
          onChangeText={handleSearchChange}
          placeholder="Барбер, маникюр, стоматолог..."
        />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {renderHeader()}
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchWrapper: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  sortBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  sortBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  sortBtnText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sortBtnTextActive: {
    color: '#FFFFFF',
  },
  cardWrapper: {
    marginBottom: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxxl,
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
