import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  apiClient,
  BusinessListItemDto,
  PaginatedResponseDto,
  colors,
  monoFont,
  spacing,
  trackEvent,
} from '@mettig/shared';
import * as Location from 'expo-location';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessListProps {
  categoryId?: string;
  showSortToggle?: boolean;
  onBusinessPress: (businessId: string) => void;
}

type SortMode = 'rating' | 'distance';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOpen(hours: Record<string, { open: string; close: string } | null>): boolean {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const day = days[new Date().getDay()];
  if (!day) return false;
  return hours[day] != null;
}

function fmtDistance(m: number | null): string | null {
  if (m == null) return null;
  if (m < 1000) return `${Math.round(m)} м`;
  return `${(m / 1000).toFixed(1)} км`;
}

// ─── B-style Business Card ────────────────────────────────────────────────────

interface BCardProps {
  item: BusinessListItemDto;
  index: number;
  onPress: () => void;
}

function BBusinessCard({ item, index, onPress }: BCardProps): React.JSX.Element {
  const open = isOpen(item.working_hours);
  const dist = fmtDistance(item.distance_m);
  const rating = item.avg_rating != null ? item.avg_rating.toFixed(1) : null;
  const photo = item.photos[0];

  return (
    <TouchableOpacity
      style={cardStyles.card}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* ── Left content ── */}
      <View style={cardStyles.left}>
        {/* Status + category */}
        <View style={cardStyles.statusRow}>
          <Text style={[cardStyles.openTag, !open && cardStyles.closedTag]}>
            {open ? '● открыто' : '○ закрыто'}
          </Text>
          <Text style={cardStyles.catTag}> · {item.category_name_ru}</Text>
        </View>

        {/* Name */}
        <Text style={cardStyles.name} numberOfLines={2}>{item.name}</Text>

        {/* Stats */}
        <View style={cardStyles.statsRow}>
          {rating != null && (
            <>
              <View style={cardStyles.statBlock}>
                <Text style={cardStyles.statHead}>рейтинг</Text>
                <Text style={cardStyles.statVal}>
                  {rating}
                  <Text style={cardStyles.statSub}> · {item.review_count}</Text>
                </Text>
              </View>
              <View style={cardStyles.statSep} />
            </>
          )}
          {dist != null && (
            <View style={cardStyles.statBlock}>
              <Text style={cardStyles.statHead}>далеко</Text>
              <Text style={cardStyles.statVal}>{dist}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Right photo ── */}
      <View style={cardStyles.photoBox}>
        {photo != null ? (
          <Image source={{ uri: photo }} style={cardStyles.photo} resizeMode="cover" />
        ) : (
          <View style={cardStyles.photoPlaceholder} />
        )}
        {/* index badge */}
        <View style={cardStyles.indexBadge}>
          <Text style={cardStyles.indexText}>{String(index + 1).padStart(2, '0')}</Text>
        </View>
        {/* arrow */}
        <View style={cardStyles.arrowBadge}>
          <Text style={cardStyles.arrowText}>→</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 10,
  },
  left: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  openTag: {
    fontFamily: monoFont,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.ok,
  },
  closedTag: {
    color: colors.textMuted,
  },
  catTag: {
    fontFamily: monoFont,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.3,
    lineHeight: 22,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 0,
    marginTop: 10,
  },
  statBlock: {
    marginRight: 14,
  },
  statSep: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
    marginRight: 14,
    alignSelf: 'center',
  },
  statHead: {
    fontFamily: monoFont,
    fontSize: 8,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  statSub: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.textMuted,
  },
  // Photo
  photoBox: {
    width: 90,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: '#e7e3d6',
  },
  indexBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(251,250,246,0.85)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  indexText: {
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: '600',
    color: colors.text,
  },
  arrowBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(251,250,246,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 13,
    color: colors.text,
  },
});

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard(): React.JSX.Element {
  return (
    <View style={[cardStyles.card, { height: 110, opacity: 0.5 }]}>
      <View style={[cardStyles.left, { backgroundColor: colors.surfaceAlt }]} />
      <View style={[cardStyles.photoBox, { backgroundColor: colors.surfaceAlt }]} />
    </View>
  );
}

// ─── Sort pill ────────────────────────────────────────────────────────────────

interface SortPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function SortPill({ label, active, onPress }: SortPillProps): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[pillStyles.pill, active && pillStyles.pillActive]}
    >
      <Text style={[pillStyles.label, active && pillStyles.labelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  pillActive: {
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  labelActive: {
    color: colors.surface,
  },
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

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearchChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(text), 300);
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────
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

  // ── Sort toggle ───────────────────────────────────────────────────────────
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
      void trackEvent({ event_type: 'catalog_sort_changed', payload: { sort: mode } });
      setSort(mode);
    },
    [sort],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: BusinessListItemDto; index: number }) => (
      <BBusinessCard item={item} index={index} onPress={() => onBusinessPress(item.id)} />
    ),
    [onBusinessPress],
  );

  const renderHeader = useCallback(() => {
    if (!showSortToggle) return null;
    return (
      <View style={listStyles.sortRow}>
        <SortPill label="По рейтингу" active={sort === 'rating'} onPress={() => { void handleSortToggle('rating'); }} />
        <SortPill label="По расстоянию" active={sort === 'distance'} onPress={() => { void handleSortToggle('distance'); }} />
      </View>
    );
  }, [showSortToggle, sort, handleSortToggle]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={listStyles.emptyContainer}>
        <Text style={listStyles.emptyText}>Ничего не найдено</Text>
        <Text style={listStyles.emptyHint}>Попробуйте изменить запрос</Text>
      </View>
    );
  }, [isLoading]);

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={listStyles.footerLoader}>
        <ActivityIndicator color={colors.accent} size="small" />
      </View>
    );
  }, [isLoadingMore]);

  const inputRef = useRef<TextInput>(null);

  return (
    <View style={listStyles.container}>
      {/* B-style search bar */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => inputRef.current?.focus()}
        style={listStyles.searchBar}
      >
        <Text style={listStyles.searchIcon}>⌕</Text>
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={handleSearchChange}
          placeholder="Внутри категории…"
          placeholderTextColor={colors.textMuted}
          style={listStyles.searchInput}
          returnKeyType="search"
        />
        <Text style={listStyles.searchFilter}>filter ↓</Text>
      </TouchableOpacity>

      {isLoading ? (
        <View style={listStyles.listContent}>
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
          contentContainerStyle={listStyles.listContent}
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

const listStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  searchIcon: {
    fontSize: 14,
    color: colors.textMuted,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  searchFilter: {
    fontFamily: monoFont,
    fontSize: 10,
    color: colors.textMuted,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 48,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  emptyHint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
