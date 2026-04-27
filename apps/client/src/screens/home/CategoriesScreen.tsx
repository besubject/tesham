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
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  apiClient,
  CategoryWithCountDto,
  CategorySearchResultDto,
  PopularBusinessItemDto,
  SearchBar,
  colors,
  resolveCategoryIcon,
  spacing,
  trackEvent,
  typography,
} from '@mettig/shared';
import type { HomeStackScreenProps } from '../../navigation/types';

type Props = HomeStackScreenProps<'CategoriesScreen'>;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CategorySkeleton(): React.JSX.Element {
  return (
    <View style={skeletonStyles.cell}>
      <View style={skeletonStyles.icon} />
      <View style={[skeletonStyles.line, { width: '60%' }]} />
      <View style={[skeletonStyles.line, { width: '40%' }]} />
    </View>
  );
}

function PopularSkeleton(): React.JSX.Element {
  return <View style={skeletonStyles.popularCard} />;
}

const skeletonStyles = StyleSheet.create({
  cell: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    margin: spacing.xs,
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 110,
  },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt },
  line: { height: 10, backgroundColor: colors.surfaceAlt, borderRadius: 4 },
  popularCard: {
    width: 140,
    height: 160,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    marginRight: spacing.md,
  },
});

// ─── Popular business card ────────────────────────────────────────────────────

interface PopularCardProps {
  item: PopularBusinessItemDto;
  onPress: (id: string) => void;
}

function PopularCard({ item, onPress }: PopularCardProps): React.JSX.Element {
  const icon = resolveCategoryIcon(item.category_icon);
  return (
    <TouchableOpacity
      style={popularStyles.card}
      onPress={() => onPress(item.id)}
      activeOpacity={0.8}
    >
      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={popularStyles.image} />
      ) : (
        <View style={[popularStyles.image, popularStyles.imagePlaceholder]}>
          <Text style={popularStyles.imagePlaceholderIcon}>{icon ?? '🏪'}</Text>
        </View>
      )}
      <View style={popularStyles.info}>
        <Text style={popularStyles.name} numberOfLines={2}>{item.name}</Text>
        {item.rating_avg > 0 && (
          <View style={popularStyles.ratingRow}>
            <Text style={popularStyles.star}>★</Text>
            <Text style={popularStyles.rating}>{item.rating_avg.toFixed(1)}</Text>
          </View>
        )}
        <Text style={popularStyles.category} numberOfLines={1}>{item.category_name}</Text>
      </View>
    </TouchableOpacity>
  );
}

const popularStyles = StyleSheet.create({
  card: {
    width: 140,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  image: { width: '100%', height: 100 },
  imagePlaceholder: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderIcon: { fontSize: 28 },
  info: { padding: spacing.sm, gap: 2 },
  name: { ...typography.bodySmall, color: colors.text, fontWeight: '600', lineHeight: 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  star: { fontSize: 12, color: colors.amber },
  rating: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  category: { ...typography.caption, color: colors.textMuted },
});

// ─── Category grid card ───────────────────────────────────────────────────────

interface CategoryCardProps {
  item: CategoryWithCountDto;
  onPress: (id: string, name: string) => void;
}

function CategoryCard({ item, onPress }: CategoryCardProps): React.JSX.Element {
  const icon = resolveCategoryIcon(item.icon);
  return (
    <TouchableOpacity
      style={catStyles.cell}
      onPress={() => onPress(item.id, item.name_ru)}
      activeOpacity={0.75}
    >
      <View style={catStyles.iconWrap}>
        <Text style={catStyles.icon}>{icon ?? '🏷️'}</Text>
      </View>
      <Text style={catStyles.name} numberOfLines={2}>{item.name_ru}</Text>
      <Text style={catStyles.count}>{item.business_count} заведений</Text>
    </TouchableOpacity>
  );
}

const catStyles = StyleSheet.create({
  cell: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    margin: spacing.xs,
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 110,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 24 },
  name: { ...typography.bodySmall, color: colors.text, fontWeight: '600', textAlign: 'center' },
  count: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});

// ─── Search result item ───────────────────────────────────────────────────────

interface SearchItemProps {
  name: string;
  subtitle?: string;
  icon?: string | null;
  onPress: () => void;
}

function SearchResultItem({ name, subtitle, icon, onPress }: SearchItemProps): React.JSX.Element {
  return (
    <TouchableOpacity style={searchStyles.item} onPress={onPress} activeOpacity={0.7}>
      {icon ? (
        <View style={searchStyles.iconWrap}>
          <Text style={searchStyles.icon}>{resolveCategoryIcon(icon) ?? '🏷️'}</Text>
        </View>
      ) : (
        <View style={[searchStyles.iconWrap, searchStyles.businessIconWrap]}>
          <Text style={searchStyles.icon}>🏪</Text>
        </View>
      )}
      <View style={searchStyles.textWrap}>
        <Text style={searchStyles.name} numberOfLines={1}>{name}</Text>
        {subtitle != null && (
          <Text style={searchStyles.subtitle} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const searchStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessIconWrap: { backgroundColor: colors.surfaceAlt },
  icon: { fontSize: 18 },
  textWrap: { flex: 1 },
  name: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  subtitle: { ...typography.caption, color: colors.textMuted },
});

// ─── CategoriesScreen ─────────────────────────────────────────────────────────

export function CategoriesScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [categories, setCategories] = useState<CategoryWithCountDto[]>([]);
  const [popular, setPopular] = useState<PopularBusinessItemDto[]>([]);
  const [searchResult, setSearchResult] = useState<CategorySearchResultDto | null>(null);

  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);

  // ── Загрузка начальных данных ─────────────────────────────────────────────
  useEffect(() => {
    void trackEvent({ event_type: 'categories_screen_opened' });

    apiClient
      .get<CategoryWithCountDto[]>('/categories')
      .then((res) => setCategories(res.data))
      .catch(() => undefined)
      .finally(() => setIsLoadingCategories(false));

    apiClient
      .get<PopularBusinessItemDto[]>('/businesses/popular')
      .then((res) => setPopular(res.data))
      .catch(() => undefined)
      .finally(() => setIsLoadingPopular(false));
  }, []);

  // ── Поиск ─────────────────────────────────────────────────────────────────
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

  // ── Навигация ─────────────────────────────────────────────────────────────
  const handleCategoryPress = useCallback(
    (id: string, name: string) => {
      void trackEvent({ event_type: 'category_selected', payload: { category_id: id, category_name: name } });
      navigation.navigate('BusinessList', { categoryId: id, categoryName: name });
    },
    [navigation],
  );

  const handlePopularPress = useCallback(
    (id: string) => {
      void trackEvent({ event_type: 'popular_business_clicked', payload: { business_id: id } });
      navigation.navigate('BusinessDetails', { businessId: id });
    },
    [navigation],
  );

  // ── Рендер поиска ─────────────────────────────────────────────────────────
  const renderSearchResults = (): React.JSX.Element => {
    if (isLoadingSearch) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }
    if (!searchResult) return <View />;

    const hasResults =
      searchResult.categories.length > 0 || searchResult.businesses.length > 0;

    if (!hasResults) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>Ничего не найдено</Text>
        </View>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {searchResult.categories.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Категории</Text>
            {searchResult.categories.map((cat) => (
              <SearchResultItem
                key={cat.id}
                name={cat.name_ru}
                subtitle={`${cat.business_count} заведений`}
                icon={cat.icon}
                onPress={() => handleCategoryPress(cat.id, cat.name_ru)}
              />
            ))}
          </>
        )}
        {searchResult.businesses.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Заведения</Text>
            {searchResult.businesses.map((b) => (
              <SearchResultItem
                key={b.id}
                name={b.name}
                subtitle={b.category_name}
                onPress={() => handlePopularPress(b.id)}
              />
            ))}
          </>
        )}
      </ScrollView>
    );
  };

  // ── Рендер сетки категорий ─────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: CategoryWithCountDto }) => (
      <CategoryCard item={item} onPress={handleCategoryPress} />
    ),
    [handleCategoryPress],
  );

  const renderHeader = useCallback((): React.JSX.Element => {
    const isLoading = isLoadingPopular;
    return (
      <View>
        {/* Популярные */}
        <Text style={styles.sectionTitle}>Популярные заведения</Text>
        {isLoading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.popularRow}>
            <PopularSkeleton />
            <PopularSkeleton />
            <PopularSkeleton />
          </ScrollView>
        ) : popular.length === 0 ? (
          <View style={styles.popularEmpty}>
            <Text style={styles.popularEmptyText}>Скоро появятся</Text>
          </View>
        ) : (
          <FlatList
            horizontal
            data={popular}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PopularCard item={item} onPress={handlePopularPress} />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.popularContent}
            style={styles.popularRow}
          />
        )}

        {/* Заголовок сетки */}
        <Text style={styles.sectionTitle}>Категории</Text>
      </View>
    );
  }, [isLoadingPopular, popular, handlePopularPress]);

  const renderEmpty = useCallback((): React.JSX.Element => {
    if (isLoadingCategories) return <View />;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🏷️</Text>
        <Text style={styles.emptyText}>Категории не найдены</Text>
      </View>
    );
  }, [isLoadingCategories]);

  const isSearchMode = query.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Поиск */}
      <View style={styles.searchWrapper}>
        <SearchBar
          value={query}
          onChangeText={handleSearchChange}
          placeholder="Барбер, маникюр, стоматолог..."
        />
      </View>

      {isSearchMode ? (
        renderSearchResults()
      ) : isLoadingCategories ? (
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
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          numColumns={2}
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
  searchWrapper: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  sectionLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
  },
  popularRow: { flexGrow: 0 },
  popularContent: { paddingHorizontal: spacing.xs },
  popularEmpty: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  popularEmptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  gridContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  skeletonGrid: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  skeletonRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxxl,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxxl,
    gap: spacing.sm,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { ...typography.bodyMedium, color: colors.text },
});
