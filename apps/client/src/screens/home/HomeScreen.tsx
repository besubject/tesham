import * as Location from 'expo-location';
import Constants from 'expo-constants';
import type {
  CameraRef,
  MapViewRef,
  OnPressEvent,
} from '@maplibre/maplibre-react-native';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  apiClient,
  borderRadius,
  BusinessCard,
  BusinessListItemDto,
  CategoryChip,
  CategoryDto,
  colors,
  PaginatedResponseDto,
  RatingBadge,
  resolveCategoryIcon,
  SearchBar,
  shadow,
  spacing,
  trackAppOpen,
  trackSearchQuery,
  typography,
} from '@mettig/shared';
import type { HomeStackScreenProps } from '../../navigation/types';

// MapLibre требует нативной сборки — в Expo Go нативный модуль не зарегистрирован.
// Проверяем appOwnership заранее и загружаем модуль только в нативной сборке.
const isExpoGo = Constants.appOwnership === 'expo';

type ML = typeof import('@maplibre/maplibre-react-native');

type Props = HomeStackScreenProps<'HomeScreen'>;
type SheetState = 'peek' | 'half' | 'full';

const OSM_STYLE_URL = 'https://demotiles.maplibre.org/style.json';
const GROZNY_LNG = 45.6845;
const GROZNY_LAT = 43.3169;
const GROZNY_COORDS: GeoJSON.Position = [GROZNY_LNG, GROZNY_LAT];
const DEFAULT_ZOOM = 13;
const LIMIT = 20;

// Высота шторки в состоянии peek (ручка + строка поиска)
const PEEK_H = 112;

function buildGeoJSON(
  businesses: BusinessListItemDto[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: businesses
      .filter((b) => b.lat != null && b.lng != null)
      .map((b) => ({
        type: 'Feature' as const,
        id: b.id,
        geometry: {
          type: 'Point' as const,
          coordinates: [b.lng as number, b.lat as number],
        },
        properties: {
          id: b.id,
          name: b.name,
          category_icon: resolveCategoryIcon(b.category_icon),
          category_name_ru: b.category_name_ru,
          avg_rating: b.avg_rating,
          review_count: b.review_count,
          photo: b.photos[0] ?? null,
          address: b.address,
        },
      })),
  };
}

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
  image: { width: '100%', height: 140, backgroundColor: colors.surfaceAlt },
  content: { padding: spacing.md, gap: spacing.sm },
  line: { height: 12, backgroundColor: colors.surfaceAlt, borderRadius: 4 },
});

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [mapLibre, setMapLibre] = useState<ML | null>(null);

  // ── Размеры контейнера ───────────────────────────────────────────────────────
  const containerH = useRef(Dimensions.get('window').height);

  // ── Шторка (bottom sheet) ────────────────────────────────────────────────────
  const initY = containerH.current - PEEK_H;
  const sheetAnim = useRef(new Animated.Value(initY)).current;
  const sheetOffset = useRef(initY);
  const sheetStateRef = useRef<SheetState>('peek');
  const [sheetState, setSheetState] = useState<SheetState>('peek');
  const listScrollY = useRef(0);

  // ── Карта ────────────────────────────────────────────────────────────────────
  const mapRef = useRef<MapViewRef | null>(null);
  const cameraRef = useRef<CameraRef | null>(null);
  const [userLocation, setUserLocation] = useState<GeoJSON.Position | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessListItemDto | null>(null);
  const [geoJSON, setGeoJSON] = useState<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    buildGeoJSON([]),
  );
  const mapBusinessesRef = useRef<BusinessListItemDto[]>([]);
  const [isMapLoading, setIsMapLoading] = useState(true);

  // ── Список бизнесов ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [listLocation, setListLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [businesses, setBusinesses] = useState<BusinessListItemDto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ── Снап шторки ─────────────────────────────────────────────────────────────
  const snapTo = useCallback(
    (state: SheetState) => {
      const h = containerH.current;
      const targets: Record<SheetState, number> = {
        peek: h - PEEK_H,
        half: h * 0.52,
        full: 0,
      };
      const targetY = targets[state];
      sheetOffset.current = targetY;
      sheetStateRef.current = state;
      setSheetState(state);
      Animated.spring(sheetAnim, {
        toValue: targetY,
        useNativeDriver: false,
        bounciness: 4,
      }).start();
    },
    [sheetAnim],
  );

  // ── PanResponder ─────────────────────────────────────────────────────────────
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gs) => {
          // В full-состоянии — только если список прокручен в начало
          if (sheetStateRef.current !== 'full') return Math.abs(gs.dy) > 5;
          return gs.dy > 8 && listScrollY.current < 2;
        },
        onPanResponderMove: (_, gs) => {
          const newY = sheetOffset.current + gs.dy;
          const maxY = containerH.current - PEEK_H;
          sheetAnim.setValue(Math.max(0, Math.min(maxY, newY)));
        },
        onPanResponderRelease: (_, gs) => {
          if (gs.dy > 0) Keyboard.dismiss();
          const curr = sheetOffset.current + gs.dy;
          const h = containerH.current;
          const snaps: Array<[SheetState, number]> = [
            ['full', 0],
            ['half', h * 0.52],
            ['peek', h - PEEK_H],
          ];
          const [targetState, targetY] = snaps.reduce((best, candidate) =>
            Math.abs(candidate[1] - curr) < Math.abs(best[1] - curr) ? candidate : best,
          );
          sheetOffset.current = targetY;
          sheetStateRef.current = targetState;
          setSheetState(targetState);
          Animated.spring(sheetAnim, {
            toValue: targetY,
            useNativeDriver: false,
            bounciness: 4,
          }).start();
        },
      }),
    [sheetAnim],
  );

  useEffect(() => {
    if (isExpoGo) return;

    let cancelled = false;

    void import('@maplibre/maplibre-react-native')
      .then((module) => {
        if (cancelled) return;
        module.setAccessToken(null);
        setMapLibre(module);
      })
      .catch(() => {
        if (!cancelled) {
          setMapLibre(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Инициализация ────────────────────────────────────────────────────────────
  const fetchMapBusinesses = useCallback(
    async (lat: number, lng: number): Promise<void> => {
      setIsMapLoading(true);
      try {
        const res = await apiClient.get<PaginatedResponseDto<BusinessListItemDto>>(
          '/businesses',
          { params: { lat, lng, limit: 200, page: 1 } },
        );
        const data = res.data.data;
        mapBusinessesRef.current = data;
        setGeoJSON(buildGeoJSON(data));
      } catch {
        // Карта работает без пинов
      } finally {
        setIsMapLoading(false);
      }
    },
    [],
  );

  const initLocation = useCallback(async (): Promise<void> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    let lat = GROZNY_LAT;
    let lng = GROZNY_LNG;

    if (status === 'granted') {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        const coords: GeoJSON.Position = [lng, lat];
        setUserLocation(coords);
        setListLocation({ lat, lng });
        cameraRef.current?.flyTo?.(coords, 600);
      } catch {
        // Нет геолокации — показываем Грозный
      }
    }
    await fetchMapBusinesses(lat, lng);
  }, [fetchMapBusinesses]);

  // ── Инициализация ────────────────────────────────────────────────────────────
  useEffect(() => {
    void trackAppOpen();
    void initLocation();
    apiClient
      .get<CategoryDto[]>('/categories')
      .then((res) => setCategories(res.data))
      .catch(() => undefined);
  }, [initLocation]);

  // ── Поиск ───────────────────────────────────────────────────────────────────
  const handleSearchChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(text), 300);
  }, []);

  const handleSearchFocus = useCallback(() => {
    if (sheetStateRef.current === 'peek') snapTo('half');
  }, [snapTo]);

  // ── Список бизнесов ──────────────────────────────────────────────────────────
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

  useEffect(() => {
    setIsLoading(true);
    fetchBusinesses(1, debouncedQuery, selectedCategoryId, listLocation, false).finally(
      () => setIsLoading(false),
    );
  }, [debouncedQuery, selectedCategoryId, listLocation, fetchBusinesses]);

  useEffect(() => {
    if (debouncedQuery.length > 0) void trackSearchQuery(debouncedQuery, businesses.length);
  }, [debouncedQuery, businesses.length]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchBusinesses(1, debouncedQuery, selectedCategoryId, listLocation, false).finally(
      () => setIsRefreshing(false),
    );
  }, [debouncedQuery, selectedCategoryId, listLocation, fetchBusinesses]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || isLoading) return;
    setIsLoadingMore(true);
    fetchBusinesses(page + 1, debouncedQuery, selectedCategoryId, listLocation, true).finally(
      () => setIsLoadingMore(false),
    );
  }, [isLoadingMore, hasMore, isLoading, page, debouncedQuery, selectedCategoryId, listLocation, fetchBusinesses]);

  const handleCategorySelect = useCallback((id: string | null) => {
    setSelectedCategoryId((prev) => (id !== null && prev === id ? null : id));
  }, []);

  // ── Взаимодействие с картой ───────────────────────────────────────────────────
  const handleShapePress = useCallback(
    async (event: OnPressEvent) => {
      const feature = event.features[0];
      if (!feature?.properties) return;
      const props = feature.properties as Record<string, unknown>;

      if (props['cluster'] === true) {
        const coords = (feature.geometry as GeoJSON.Point).coordinates;
        const zoom = (await mapRef.current?.getZoom()) ?? DEFAULT_ZOOM;
        cameraRef.current?.setCamera({
          centerCoordinate: coords,
          zoomLevel: zoom + 2,
          animationDuration: 400,
        });
        return;
      }

      const id = props['id'] as string;
      const business = mapBusinessesRef.current.find((b) => b.id === id);
      if (business) {
        setSelectedBusiness(business);
        snapTo('half');
      }
    },
    [snapTo],
  );

  const handleMapPress = useCallback(() => {
    if (selectedBusiness != null) {
      setSelectedBusiness(null);
    } else if (sheetStateRef.current !== 'peek') {
      snapTo('peek');
    }
  }, [selectedBusiness, snapTo]);

  const handleCenterUser = useCallback(() => {
    if (userLocation) cameraRef.current?.flyTo(userLocation, 600);
  }, [userLocation]);

  const handleOpenBusiness = useCallback(
    (businessId: string) => {
      setSelectedBusiness(null);
      navigation.navigate('BusinessDetails', { businessId });
    },
    [navigation],
  );

  // ── Рендер элементов списка ───────────────────────────────────────────────────
  const renderBusiness = useCallback(
    ({ item }: { item: BusinessListItemDto }) => (
      <View style={styles.cardWrapper}>
        <BusinessCard
          business={item}
          onPress={() => handleOpenBusiness(item.id)}
        />
      </View>
    ),
    [handleOpenBusiness],
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

  // ── Рендер ───────────────────────────────────────────────────────────────────
  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h !== containerH.current) {
          containerH.current = h;
          // Пересчитываем позицию под новые размеры
          snapTo(sheetStateRef.current);
        }
      }}
    >
      {/* ── Карта (фон) — только в нативной сборке ── */}
      {mapLibre != null ? (
        <mapLibre.MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          mapStyle={OSM_STYLE_URL}
          logoEnabled={false}
          attributionEnabled={false}
          onPress={handleMapPress}
        >
          <mapLibre.Camera
            ref={cameraRef}
            defaultSettings={{ centerCoordinate: GROZNY_COORDS, zoomLevel: DEFAULT_ZOOM }}
          />
          {userLocation != null && <mapLibre.UserLocation visible />}

          <mapLibre.ShapeSource
            id="businesses"
            shape={geoJSON}
            cluster
            clusterRadius={50}
            clusterMaxZoomLevel={14}
            onPress={handleShapePress}
          >
            <mapLibre.CircleLayer
              id="clusters"
              filter={['has', 'point_count']}
              style={{
                circleColor: colors.accent,
                circleRadius: ['step', ['get', 'point_count'], 18, 10, 22, 50, 26],
                circleOpacity: 0.9,
              }}
            />
            <mapLibre.SymbolLayer
              id="cluster-count"
              filter={['has', 'point_count']}
              style={{
                textField: '{point_count_abbreviated}',
                textSize: 13,
                textColor: colors.white,
                textIgnorePlacement: true,
                textAllowOverlap: true,
              }}
            />
            <mapLibre.CircleLayer
              id="unclustered-point"
              filter={['!', ['has', 'point_count']]}
              style={{
                circleColor: colors.accent,
                circleRadius: 14,
                circleStrokeWidth: 2,
                circleStrokeColor: colors.white,
              }}
            />
            <mapLibre.SymbolLayer
              id="unclustered-icon"
              filter={['!', ['has', 'point_count']]}
              style={{
                textField: '{category_icon}',
                textSize: 14,
                textIgnorePlacement: true,
                textAllowOverlap: true,
              }}
            />
          </mapLibre.ShapeSource>
        </mapLibre.MapView>
      ) : (
        /* Expo Go — показываем фон вместо карты */
        <View style={[StyleSheet.absoluteFill, styles.mapPlaceholder]} />
      )}

      {/* ── Загрузка карты ── */}
      {isMapLoading && (
        <View style={[styles.mapLoadingBadge, { top: insets.top + spacing.sm }]}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      )}

      {/* ── Кнопка "моё местоположение" ── */}
      {userLocation != null && (
        <Animated.View
          style={[
            styles.locationBtnWrapper,
            {
              transform: [
                {
                  translateY: sheetAnim.interpolate({
                    inputRange: [0, containerH.current - PEEK_H],
                    outputRange: [-(containerH.current - PEEK_H - spacing.xl), 0],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={handleCenterUser}
            activeOpacity={0.8}
            accessibilityLabel="Моё местоположение"
          >
            <Text style={styles.locationBtnIcon}>📍</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Шторка (bottom sheet) ── */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}
      >
        {/* Ручка */}
        <View style={styles.handleArea}>
          <View style={styles.pill} />
        </View>

        {/* Поиск */}
        <View style={styles.searchWrapper}>
          <SearchBar
            value={query}
            onChangeText={handleSearchChange}
            onFocus={handleSearchFocus}
            placeholder="Барбер, маникюр, стоматолог..."
          />
        </View>

        {/* Мини-карточка выбранного бизнеса */}
        {selectedBusiness != null && (
          <View style={styles.miniCardWrapper}>
            <Pressable
              style={styles.miniCard}
              onPress={() => handleOpenBusiness(selectedBusiness.id)}
              accessibilityRole="button"
              accessibilityLabel={`Открыть ${selectedBusiness.name}`}
            >
              {selectedBusiness.photos[0] != null ? (
                <Image
                  source={{ uri: selectedBusiness.photos[0] }}
                  style={styles.miniCardPhoto}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.miniCardPhoto, styles.miniCardPhotoPlaceholder]}>
                  <Text style={styles.miniCardEmoji}>{resolveCategoryIcon(selectedBusiness.category_icon) ?? '🏢'}</Text>
                </View>
              )}
              <View style={styles.miniCardBody}>
                <Text style={styles.miniCardName} numberOfLines={1}>
                  {selectedBusiness.name}
                </Text>
                <Text style={styles.miniCardCategory} numberOfLines={1}>
                  {selectedBusiness.category_name_ru}
                </Text>
                {selectedBusiness.avg_rating != null && (
                  <View style={styles.miniCardRatingRow}>
                    <RatingBadge rating={selectedBusiness.avg_rating} />
                    <Text style={styles.miniCardReviews}>
                      {selectedBusiness.review_count} отзывов
                    </Text>
                  </View>
                )}
                <Text style={styles.miniCardAddress} numberOfLines={1}>
                  {selectedBusiness.address}
                </Text>
              </View>
              <Text style={styles.miniCardChevron}>›</Text>
            </Pressable>
            <TouchableOpacity
              style={styles.miniCardCloseBtn}
              onPress={() => setSelectedBusiness(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Закрыть"
            >
              <Text style={styles.miniCardCloseIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Категории */}
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContent}
            style={styles.categoriesRow}
            scrollEnabled={sheetState !== 'peek'}
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

        {/* Список бизнесов */}
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
            scrollEnabled={sheetState === 'full'}
            onScroll={(e) => {
              listScrollY.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.accent}
              />
            }
          />
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  mapPlaceholder: {
    backgroundColor: '#D6E8D6',
  },
  // ── Карта
  mapLoadingBadge: {
    position: 'absolute',
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  locationBtnWrapper: {
    position: 'absolute',
    right: spacing.lg,
    bottom: PEEK_H + spacing.md,
  },
  locationBtn: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  locationBtnIcon: {
    fontSize: 22,
  },
  // ── Шторка
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...shadow.md,
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  pill: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  searchWrapper: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // ── Мини-карточка
  miniCardWrapper: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  miniCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    ...shadow.sm,
  },
  miniCardPhoto: {
    width: 72,
    height: 80,
  },
  miniCardPhotoPlaceholder: {
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCardEmoji: {
    fontSize: 28,
  },
  miniCardBody: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  miniCardName: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  miniCardCategory: {
    ...typography.caption,
    color: colors.textMuted,
  },
  miniCardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  miniCardReviews: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  miniCardAddress: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  miniCardChevron: {
    fontSize: 24,
    color: colors.textMuted,
    paddingRight: spacing.md,
  },
  miniCardCloseBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  miniCardCloseIcon: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  // ── Категории
  categoriesRow: {
    flexGrow: 0,
    minHeight: 46,
    marginBottom: spacing.md,
  },
  categoriesContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
    alignItems: 'center',
  },
  // ── Список
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
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
