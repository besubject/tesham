import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  apiClient,
  BusinessCard,
  BusinessListItemDto,
  CategoryChip,
  CategoryDto,
  colors,
  PaginatedResponseDto,
  SearchBar,
  spacing,
  typography,
  trackAppOpen,
  trackSearchQuery,
} from '@mettig/shared';
import type { HomeStackScreenProps } from '../../navigation/types';

type Props = HomeStackScreenProps<'HomeScreen'>;

const LIMIT = 20;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

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
  image: {
    width: '100%',
    height: 140,
    backgroundColor: colors.surfaceAlt,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  line: {
    height: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
  },
});

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  // Search
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Categories
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Geolocation
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Business list
  const [businesses, setBusinesses] = useState<BusinessListItemDto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ── App initialization ──────────────────────────────────────────────────────
  useEffect(() => {
    void trackAppOpen();
  }, []);

  // ── Geolocation ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        // Геолокация недоступна — показываем по рейтингу
      }
    })();
  }, []);

  // ── Categories ──────────────────────────────────────────────────────────────
  useEffect(() => {
    apiClient
      .get<CategoryDto[]>('/categories')
      .then((res) => setCategories(res.data))
      .catch(() => undefined); // категории опциональны
  }, []);

  // ── Debounce search ──────────────────────────────────────────────────────────
  const handleSearchChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(text);
    }, 300);
  }, []);

  // ── Fetch businesses ─────────────────────────────────────────────────────────
  const fetchBusinesses = useCallback(
    async (
      p: number,
      q: string,
      categoryId: string | null,
      loc: { lat: number; lng: number } | null,
      append: boolean,
    ): Promise<void> => {
      const params: Record<string, string | number> = { page: p, limit: LIMIT };
      if (q) params['query'] = q;
      if (categoryId) params['category_id'] = categoryId;
      if (loc) {
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

  // ── Initial / filter change ──────────────────────────────────────────────────
  useEffect(() => {
    setIsLoading(true);
    fetchBusinesses(1, debouncedQuery, selectedCategoryId, location, false).finally(
      () => setIsLoading(false),
    );
  }, [debouncedQuery, selectedCategoryId, location, fetchBusinesses]);

  // ── Track search queries ──────────────────────────────────────────────────────
  useEffect(() => {
    if (debouncedQuery.length > 0) {
      void trackSearchQuery(debouncedQuery, businesses.length);
    }
  }, [debouncedQuery, businesses.length]);

  // ── Pull-to-refresh ──────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchBusinesses(1, debouncedQuery, selectedCategoryId, location, false).finally(
      () => setIsRefreshing(false),
    );
  }, [debouncedQuery, selectedCategoryId, location, fetchBusinesses]);

  // ── Infinite scroll ──────────────────────────────────────────────────────────
  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || isLoading) return;
    setIsLoadingMore(true);
    fetchBusinesses(page + 1, debouncedQuery, selectedCategoryId, location, true).finally(
      () => setIsLoadingMore(false),
    );
  }, [isLoadingMore, hasMore, isLoading, page, debouncedQuery, selectedCategoryId, location, fetchBusinesses]);

  // ── Category select ──────────────────────────────────────────────────────────
  const handleCategorySelect = useCallback((id: string | null) => {
    setSelectedCategoryId((prev) => (id !== null && prev === id ? null : id));
  }, []);

  // ── Render items ─────────────────────────────────────────────────────────────
  const renderBusiness = useCallback(
    ({ item }: { item: BusinessListItemDto }) => (
      <View style={styles.cardWrapper}>
        <BusinessCard
          business={item}
          onPress={() => navigation.navigate('BusinessDetails', { businessId: item.id })}
        />
      </View>
    ),
    [navigation],
  );

  const renderHeader = useCallback(
    () => <Text style={styles.sectionTitle}>Рядом с вами</Text>,
    [],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyText}>Ничего не найдено</Text>
        <Text style={styles.emptyHint}>Попробуйте изменить запрос или категорию</Text>
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

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      {/* Search bar */}
      <View style={styles.searchWrapper}>
        <SearchBar
          value={query}
          onChangeText={handleSearchChange}
          placeholder="Барбер, маникюр, стоматолог..."
        />
      </View>

      {/* Categories horizontal scroll */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
          style={styles.categoriesRow}
        >
          <CategoryChip
            label="Все"
            selected={selectedCategoryId === null}
            onPress={() => handleCategorySelect(null)}
          />
          {categories.map((cat) => (
            <CategoryChip
              key={cat.id}
              label={cat.name_ru}
              icon={cat.icon}
              selected={selectedCategoryId === cat.id}
              onPress={() => handleCategorySelect(cat.id)}
            />
          ))}
        </ScrollView>
      )}

      {/* Business list with skeleton */}
      {isLoading ? (
        <View style={styles.listContent}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={(item) => item.id}
          renderItem={renderBusiness}
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
    backgroundColor: colors.bg,
  },
  searchWrapper: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  categoriesRow: {
    flexGrow: 0,
    marginBottom: spacing.sm,
  },
  categoriesContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
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
