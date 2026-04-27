import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  apiClient,
  BookingItemDto,
  CategoryWithCountDto,
  CategorySearchResultDto,
  colors,
  monoFont,
  spacing,
  trackEvent,
} from '@mettig/shared';
import type { HomeStackScreenProps } from '../../navigation/types';

type Props = HomeStackScreenProps<'CategoriesScreen'>;

// ─── BMono label ──────────────────────────────────────────────────────────────

function MonoLabel({ children, style }: { children: string; style?: object }): React.JSX.Element {
  return (
    <Text style={[monoLabelStyle, style]}>
      {children}
    </Text>
  );
}
const monoLabelStyle = {
  fontFamily: monoFont,
  fontSize: 10,
  letterSpacing: 0.6,
  textTransform: 'uppercase' as const,
  color: colors.textMuted,
};

// ─── Search bar ───────────────────────────────────────────────────────────────

interface SearchBarProps {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}

function BSearchBar({ value, onChangeText, placeholder = 'Поиск' }: SearchBarProps): React.JSX.Element {
  const inputRef = useRef<TextInput>(null);
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => inputRef.current?.focus()}
      style={searchBarStyle}
    >
      <Text style={{ fontSize: 14, color: colors.textMuted }}>⌕</Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={searchInputStyle}
        returnKeyType="search"
      />
      <Text style={{ fontFamily: monoFont, fontSize: 10, color: colors.textMuted }}>filter ↓</Text>
    </TouchableOpacity>
  );
}
const searchBarStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 14,
  paddingHorizontal: 16,
  paddingVertical: 14,
  gap: 10,
};
const searchInputStyle = {
  flex: 1,
  fontSize: 14,
  color: colors.text,
  padding: 0,
};

// ─── Category card ────────────────────────────────────────────────────────────

interface CategoryCardProps {
  item: CategoryWithCountDto;
  index: number;
  onPress: (id: string, name: string) => void;
}

function CategoryCard({ item, index, onPress }: CategoryCardProps): React.JSX.Element {
  const isHot = item.business_count >= 30;
  return (
    <TouchableOpacity
      style={catStyles.card}
      onPress={() => onPress(item.id, item.name_ru)}
      activeOpacity={0.75}
    >
      {/* top row: index + hot badge */}
      <View style={catStyles.topRow}>
        <Text style={catStyles.indexNum}>{String(index + 1).padStart(2, '0')}</Text>
        {isHot && (
          <View style={catStyles.hotBadge}>
            <View style={catStyles.hotDot} />
            <Text style={catStyles.hotText}>HOT</Text>
          </View>
        )}
      </View>

      {/* category name */}
      <Text style={catStyles.name}>{item.name_ru}</Text>

      {/* count */}
      <Text style={catStyles.count}>
        {item.business_count} мест{isHot ? ' · быстро уходят' : ''}
      </Text>
    </TouchableOpacity>
  );
}

const catStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    margin: 5,
    minHeight: 130,
    justifyContent: 'flex-end',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 'auto',
  },
  indexNum: {
    fontFamily: monoFont,
    fontSize: 9,
    color: colors.textMuted,
  },
  hotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hotDot: {
    width: 5,
    height: 5,
    borderRadius: 99,
    backgroundColor: colors.accent,
  },
  hotText: {
    fontFamily: monoFont,
    fontSize: 9,
    color: colors.accent,
    letterSpacing: 0.6,
  },
  name: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.4,
    lineHeight: 24,
    marginTop: 36,
  },
  count: {
    marginTop: 6,
    fontSize: 11,
    color: colors.textMuted,
  },
});

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CategorySkeleton(): React.JSX.Element {
  return (
    <View style={[catStyles.card, { backgroundColor: colors.surfaceAlt, borderColor: colors.surfaceAlt }]} />
  );
}

// ─── Search result item ───────────────────────────────────────────────────────

interface SearchItemProps {
  name: string;
  subtitle?: string;
  onPress: () => void;
}

function SearchResultItem({ name, subtitle, onPress }: SearchItemProps): React.JSX.Element {
  return (
    <TouchableOpacity style={srStyles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={srStyles.text}>
        <Text style={srStyles.name} numberOfLines={1}>{name}</Text>
        {subtitle != null && <Text style={srStyles.sub} numberOfLines={1}>{subtitle}</Text>}
      </View>
      <Text style={srStyles.arrow}>→</Text>
    </TouchableOpacity>
  );
}

const srStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  sub: { fontFamily: monoFont, fontSize: 10, color: colors.textMuted, letterSpacing: 0.4 },
  arrow: { fontSize: 16, color: colors.textMuted, marginLeft: 10 },
});

// ─── Quick Actions (booking card) ────────────────────────────────────────────

function timeUntil(dateStr: string, timeStr: string): string {
  const now = new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.slice(0, 5).split(':').map(Number);
  const target = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0);
  const diffMin = Math.round((target.getTime() - now.getTime()) / 60000);
  if (diffMin <= 0) return 'сейчас';
  if (diffMin < 60) return `через ${diffMin} мин`;
  const hours = Math.floor(diffMin / 60);
  return `через ${hours} ч`;
}

function isToday(dateStr: string): boolean {
  const now = new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return now.getFullYear() === y && now.getMonth() + 1 === m && now.getDate() === d;
}

interface QuickActionsProps {
  booking: BookingItemDto;
  onBookingsPress: () => void;
  onBookingPress: (bookingId: string) => void;
}

function QuickActions({ booking, onBookingsPress, onBookingPress }: QuickActionsProps): React.JSX.Element {
  const time = booking.slot_start_time.slice(0, 5);
  const dateLabel = isToday(booking.slot_date) ? 'Сегодня' : booking.slot_date;
  const until = isToday(booking.slot_date) ? timeUntil(booking.slot_date, booking.slot_start_time) : null;

  return (
    <View style={qaStyles.row}>
      {/* Left dark card — go to all bookings */}
      <TouchableOpacity style={qaStyles.darkCard} onPress={onBookingsPress} activeOpacity={0.8}>
        <Text style={qaStyles.darkMono}>Мои записи</Text>
        <Text style={qaStyles.darkName}>{booking.business_name}</Text>
        <Text style={qaStyles.darkSub}>{booking.service_name}</Text>
        <View style={qaStyles.darkFooter}>
          <View style={qaStyles.darkDots}>
            <View style={qaStyles.dotFill} />
            <View style={qaStyles.dotFill} />
            <View style={qaStyles.dotEmpty} />
          </View>
          <Text style={qaStyles.darkArrow}>→</Text>
        </View>
      </TouchableOpacity>

      {/* Right light card — nearest booking */}
      <TouchableOpacity
        style={qaStyles.lightCard}
        onPress={() => onBookingPress(booking.id)}
        activeOpacity={0.8}
      >
        <Text style={qaStyles.lightMono}>{dateLabel}</Text>
        <Text style={qaStyles.lightTime}>{time}</Text>
        <Text style={qaStyles.lightSub} numberOfLines={1}>
          {booking.staff_name} · {booking.business_name}
        </Text>
        {until != null && (
          <View style={qaStyles.badge}>
            <Text style={qaStyles.badgeText}>{until}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const qaStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  // Dark card
  darkCard: {
    flex: 1.4,
    backgroundColor: colors.text,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 18,
    padding: 14,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  darkMono: {
    fontFamily: monoFont,
    fontSize: 9,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  darkName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.surface,
    marginTop: 8,
  },
  darkSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  darkFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  darkDots: { flexDirection: 'row', gap: 4 },
  dotFill: { width: 18, height: 2, backgroundColor: colors.surface },
  dotEmpty: { width: 18, height: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  darkArrow: { fontSize: 18, color: colors.surface },

  // Light card
  lightCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    minHeight: 120,
  },
  lightMono: {
    fontFamily: monoFont,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  lightTime: {
    fontSize: 30,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -1,
    lineHeight: 34,
    marginTop: 8,
  },
  lightSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  badge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: colors.accentSoft,
  },
  badgeText: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

// ─── CategoriesScreen (B_Home) ────────────────────────────────────────────────

export function CategoriesScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [categories, setCategories] = useState<CategoryWithCountDto[]>([]);
  const [searchResult, setSearchResult] = useState<CategorySearchResultDto | null>(null);
  const [nearestBooking, setNearestBooking] = useState<BookingItemDto | null>(null);

  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    void trackEvent({ event_type: 'categories_screen_opened' });

    apiClient
      .get<CategoryWithCountDto[]>('/categories')
      .then((res) => setCategories(res.data))
      .catch(() => undefined)
      .finally(() => setIsLoadingCategories(false));

    // Fetch nearest upcoming booking for the quick actions card
    apiClient
      .get<{ bookings: BookingItemDto[] }>('/bookings/my')
      .then((res) => {
        const upcoming = res.data.bookings.filter((b) => b.status === 'confirmed');
        setNearestBooking(upcoming[0] ?? null);
      })
      .catch(() => undefined);
  }, []);

  // ── Search debounce ───────────────────────────────────────────────────────
  const handleSearchChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(text), 300);
  }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResult(null);
      return;
    }
    setIsLoadingSearch(true);
    apiClient
      .get<CategorySearchResultDto>('/categories/search', { params: { q: debouncedQuery } })
      .then((res) => setSearchResult(res.data))
      .catch(() => setSearchResult({ categories: [], businesses: [] }))
      .finally(() => setIsLoadingSearch(false));
  }, [debouncedQuery]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleCategoryPress = useCallback(
    (id: string, name: string) => {
      void trackEvent({ event_type: 'category_selected', payload: { category_id: id, category_name: name } });
      navigation.navigate('BusinessList', { categoryId: id, categoryName: name });
    },
    [navigation],
  );

  const handleBusinessPress = useCallback(
    (id: string) => {
      navigation.navigate('BusinessDetails', { businessId: id });
    },
    [navigation],
  );

  const handleBookingsTabPress = useCallback(() => {
    navigation.navigate('Bookings');
  }, [navigation]);

  // ── Search results view ───────────────────────────────────────────────────
  const renderSearchResults = (): React.JSX.Element => {
    if (isLoadingSearch) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }
    if (!searchResult) return <View />;
    const hasResults = searchResult.categories.length > 0 || searchResult.businesses.length > 0;
    if (!hasResults) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Ничего не найдено</Text>
        </View>
      );
    }
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {searchResult.categories.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>КАТЕГОРИИ</Text>
            {searchResult.categories.map((cat) => (
              <SearchResultItem
                key={cat.id}
                name={cat.name_ru}
                subtitle={`${cat.business_count} заведений`}
                onPress={() => handleCategoryPress(cat.id, cat.name_ru)}
              />
            ))}
          </>
        )}
        {searchResult.businesses.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>ЗАВЕДЕНИЯ</Text>
            {searchResult.businesses.map((b) => (
              <SearchResultItem
                key={b.id}
                name={b.name}
                subtitle={b.category_name}
                onPress={() => handleBusinessPress(b.id)}
              />
            ))}
          </>
        )}
      </ScrollView>
    );
  };

  // ── Category grid ─────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: CategoryWithCountDto; index: number }) => (
      <CategoryCard item={item} index={index} onPress={handleCategoryPress} />
    ),
    [handleCategoryPress],
  );

  const renderHeader = useCallback((): React.JSX.Element => (
    <View>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <MonoLabel>MTG · Грозный</MonoLabel>
        <MonoLabel>01 / Главная</MonoLabel>
      </View>

      {/* Hero title */}
      <View style={styles.heroBlock}>
        <Text style={styles.heroTitle}>Запись.</Text>
        <Text style={styles.heroSub}>За одну минуту.</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <BSearchBar
          value={query}
          onChangeText={handleSearchChange}
          placeholder="Барбер, маникюр, стоматолог…"
        />
      </View>

      {/* Quick Actions — nearest booking card */}
      {nearestBooking != null && (
        <QuickActions
          booking={nearestBooking}
          onBookingsPress={handleBookingsTabPress}
          onBookingPress={handleBookingsTabPress}
        />
      )}

      {/* Section header */}
      <View style={styles.catHeader}>
        <Text style={styles.catTitle}>Категории</Text>
        {!isLoadingCategories && (
          <MonoLabel>{`${categories.length} разделов`}</MonoLabel>
        )}
      </View>
    </View>
  ), [query, handleSearchChange, nearestBooking, handleBookingsTabPress, categories.length, isLoadingCategories]);

  const renderEmpty = useCallback((): React.JSX.Element => {
    if (isLoadingCategories) {
      return (
        <View style={styles.skeletonGrid}>
          <View style={styles.skeletonRow}>
            <CategorySkeleton />
            <CategorySkeleton />
          </View>
          <View style={styles.skeletonRow}>
            <CategorySkeleton />
            <CategorySkeleton />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Категории не найдены</Text>
      </View>
    );
  }, [isLoadingCategories]);

  const isSearchMode = query.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {isSearchMode ? (
        <>
          <View style={styles.searchWrap}>
            <BSearchBar
              value={query}
              onChangeText={handleSearchChange}
              placeholder="Барбер, маникюр, стоматолог…"
            />
          </View>
          {renderSearchResults()}
        </>
      ) : (
        <FlatList
          data={isLoadingCategories ? [] : categories}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
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
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
  },
  heroBlock: {
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -1.2,
    lineHeight: 40,
    color: colors.text,
  },
  heroSub: {
    fontSize: 38,
    fontWeight: '300',
    letterSpacing: -1.2,
    lineHeight: 40,
    color: colors.textMuted,
  },
  searchWrap: {
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
    paddingTop: 8,
  },
  catTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  // paddingHorizontal intentionally absent — header manages its own 18px insets,
  // grid items use columnWrapperStyle so they aren't double-padded
  gridContent: {
    paddingBottom: 120,
  },
  // 13 + card margin (5) = 18px from edge — aligns with header elements
  columnWrapper: {
    paddingHorizontal: 13,
  },
  // Skeleton
  skeletonGrid: {
    paddingHorizontal: 13,
    paddingTop: spacing.md,
  },
  skeletonRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  // Search / empty
  sectionLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.textMuted,
    paddingHorizontal: 18,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
