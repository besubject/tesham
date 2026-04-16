import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  apiClient,
  AvatarInitials,
  borderRadius,
  BusinessDetailDto,
  colors,
  PaginatedResponseDto,
  ReviewCard,
  ReviewItemDto,
  ServiceItemDto,
  SlotChip,
  SlotItemDto,
  spacing,
  StaffItemDto,
  typography,
} from '@mettig/shared';
import type { HomeStackScreenProps } from '../../navigation/types';

type Props = HomeStackScreenProps<'BusinessDetails'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayDate(): string {
  return new Date().toISOString().split('T')[0] as string;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
  }
  return phone;
}

function todayWorkingHours(hours: Record<string, { open: string; close: string } | null>): string | null {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const day = days[new Date().getDay()];
  if (!day) return null;
  const h = hours[day];
  if (!h) return 'Выходной';
  return `${h.open} – ${h.close}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StaffRowProps {
  staff: StaffItemDto;
  slots: SlotItemDto[];
  onBook: (staffId: string) => void;
}

function StaffRow({ staff, slots, onBook }: StaffRowProps): React.JSX.Element {
  const staffSlots = slots
    .filter((s) => s.staff_id === staff.id && !s.is_booked)
    .slice(0, 4);

  return (
    <View style={staffStyles.row}>
      <View style={staffStyles.header}>
        <AvatarInitials name={staff.name} avatarUrl={staff.avatar_url} size={44} />
        <View style={staffStyles.info}>
          <Text style={staffStyles.name}>{staff.name}</Text>
          <Text style={staffStyles.role}>{staff.role}</Text>
        </View>
        <TouchableOpacity
          style={staffStyles.bookBtn}
          onPress={() => onBook(staff.id)}
          activeOpacity={0.8}
        >
          <Text style={staffStyles.bookBtnText}>Записаться</Text>
        </TouchableOpacity>
      </View>

      {staffSlots.length > 0 && (
        <View style={staffStyles.slots}>
          {staffSlots.map((slot) => (
            <SlotChip key={slot.id} time={slot.start_time.slice(0, 5)} />
          ))}
        </View>
      )}
    </View>
  );
}

const staffStyles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  role: {
    ...typography.caption,
    color: colors.textMuted,
  },
  bookBtn: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bookBtnText: {
    ...typography.buttonSmall,
    color: colors.white,
  },
  slots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});

interface ServiceRowProps {
  service: ServiceItemDto;
}

function ServiceRow({ service }: ServiceRowProps): React.JSX.Element {
  return (
    <View style={serviceStyles.row}>
      <View style={serviceStyles.info}>
        <Text style={serviceStyles.name}>{service.name}</Text>
        <Text style={serviceStyles.duration}>{service.duration_minutes} мин</Text>
      </View>
      <Text style={serviceStyles.price}>{service.price.toLocaleString('ru-RU')} ₽</Text>
    </View>
  );
}

const serviceStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.body,
    color: colors.text,
  },
  duration: {
    ...typography.caption,
    color: colors.textMuted,
  },
  price: {
    ...typography.bodyMedium,
    color: colors.accent,
  },
});

// ─── Static Map ───────────────────────────────────────────────────────────────

interface StaticMapProps {
  lat: number;
  lng: number;
  onYandexMaps: () => void;
  onTwoGis: () => void;
}

function StaticMap({ lat, lng, onYandexMaps, onTwoGis }: StaticMapProps): React.JSX.Element {
  const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=16&size=600x200&markers=${lat},${lng},ol-marker`;

  return (
    <View style={mapStyles.container}>
      <Image
        source={{ uri: mapUrl }}
        style={mapStyles.image}
        resizeMode="cover"
        accessibilityLabel="Карта расположения"
      />
      <View style={mapStyles.buttons}>
        <TouchableOpacity style={mapStyles.mapBtn} onPress={onYandexMaps} activeOpacity={0.8}>
          <Text style={mapStyles.mapBtnText}>Яндекс.Карты</Text>
        </TouchableOpacity>
        <TouchableOpacity style={mapStyles.mapBtn} onPress={onTwoGis} activeOpacity={0.8}>
          <Text style={mapStyles.mapBtnText}>2ГИС</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const mapStyles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    height: 180,
    backgroundColor: colors.surfaceAlt,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  mapBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  mapBtnText: {
    ...typography.label,
    color: colors.text,
  },
});

// ─── Mini-map section ─────────────────────────────────────────────────────────

interface MiniMapSectionProps {
  lat: number;
  lng: number;
  onYandexMaps: (lat: number, lng: number) => void;
  onTwoGis: (lat: number, lng: number) => void;
}

function MiniMapSection({ lat, lng, onYandexMaps, onTwoGis }: MiniMapSectionProps): React.JSX.Element {
  return (
    <View style={styles.section}>
      <SectionHeader title="На карте" />
      <StaticMap
        lat={lat}
        lng={lng}
        onYandexMaps={() => onYandexMaps(lat, lng)}
        onTwoGis={() => onTwoGis(lat, lng)}
      />
    </View>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return <Text style={sectionHeaderStyles.title}>{title}</Text>;
}

const sectionHeaderStyles = StyleSheet.create({
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
});

// ─── BusinessDetailsScreen ────────────────────────────────────────────────────

export function BusinessDetailsScreen({ navigation, route }: Props): React.JSX.Element {
  const { businessId } = route.params;
  const insets = useSafeAreaInsets();

  const [business, setBusiness] = useState<BusinessDetailDto | null>(null);
  const [reviews, setReviews] = useState<ReviewItemDto[]>([]);
  const [slots, setSlots] = useState<SlotItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const today = todayDate();
    Promise.all([
      apiClient.get<BusinessDetailDto>(`/businesses/${businessId}`),
      apiClient.get<PaginatedResponseDto<ReviewItemDto>>(`/businesses/${businessId}/reviews`, {
        params: { limit: 3, page: 1 },
      }),
      apiClient
        .get<{ slots: SlotItemDto[] }>(`/businesses/${businessId}/slots`, { params: { date: today } })
        .catch(() => ({ data: { slots: [] as SlotItemDto[] } })),
    ])
      .then(([bizRes, revRes, slotsRes]) => {
        setBusiness(bizRes.data);
        setReviews(revRes.data.data ?? []);
        setSlots(slotsRes.data.slots ?? []);
      })
      .finally(() => setIsLoading(false));
  }, [businessId]);

  // ── Favorite toggle ─────────────────────────────────────────────────────────
  const handleFavoriteToggle = useCallback(async () => {
    if (isTogglingFavorite) return;
    setIsTogglingFavorite(true);
    try {
      if (isFavorite && favoriteId) {
        await apiClient.delete(`/favorites/${favoriteId}`);
        setIsFavorite(false);
        setFavoriteId(null);
      } else {
        const res = await apiClient.post<{ id: string }>('/favorites', {
          business_id: businessId,
        });
        setIsFavorite(true);
        setFavoriteId(res.data.id);
      }
    } catch {
      // API not yet available (TASK-014 pending) — toggle optimistically
      setIsFavorite((prev) => !prev);
    } finally {
      setIsTogglingFavorite(false);
    }
  }, [isFavorite, favoriteId, businessId, isTogglingFavorite]);

  // ── Navigation deep links ───────────────────────────────────────────────────
  const openYandexMaps = useCallback((lat: number, lng: number) => {
    const marker = `${lng},${lat},pm2rdm`;
    const deepLink = `yandexmaps://maps.yandex.ru/?ll=${lng},${lat}&z=17&pt=${marker}`;
    const webFallback = `https://yandex.ru/maps/?ll=${lng},${lat}&z=17&pt=${marker}`;

    Linking.canOpenURL(deepLink)
      .then((supported) => {
        if (supported) return Linking.openURL(deepLink);
        return Linking.openURL(webFallback);
      })
      .catch(() => Linking.openURL(webFallback));
  }, []);

  const openTwoGis = useCallback((lat: number, lng: number) => {
    const deepLink = `dgis://2gis.ru/routeSearch/rsType/car/to/${lng},${lat}`;
    const webFallback = `https://2gis.ru/routeSearch/rsType/car/to/${lng},${lat}`;

    Linking.canOpenURL(deepLink)
      .then((supported) => {
        if (supported) return Linking.openURL(deepLink);
        return Linking.openURL(webFallback);
      })
      .catch(() => Linking.openURL(webFallback));
  }, []);

  const handleBooking = useCallback(
    (staffId?: string) => {
      navigation.navigate('BookingSlots', { businessId, staffId });
    },
    [navigation, businessId],
  );

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.errorText}>Не удалось загрузить данные</Text>
      </View>
    );
  }

  const todayHours = todayWorkingHours(
    business.working_hours as Record<string, { open: string; close: string } | null>,
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {business.name}
        </Text>
        <TouchableOpacity
          style={styles.favoriteBtn}
          onPress={() => void handleFavoriteToggle()}
          activeOpacity={0.7}
          accessibilityLabel={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
        >
          <Text style={[styles.favoriteIcon, isFavorite && styles.favoriteIconActive]}>
            {isFavorite ? '♥' : '♡'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Photos */}
        {business.photos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photosRow}
            contentContainerStyle={styles.photosContent}
          >
            {business.photos.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.photo} resizeMode="cover" />
            ))}
          </ScrollView>
        )}

        {/* Main info */}
        <View style={styles.section}>
          <Text style={styles.businessName}>{business.name}</Text>
          <Text style={styles.categoryName}>{business.category_name_ru}</Text>

          {/* Rating */}
          {business.avg_rating !== null && (
            <View style={styles.ratingRow}>
              <Text style={styles.ratingStars}>★</Text>
              <Text style={styles.ratingValue}>{Number(business.avg_rating).toFixed(1)}</Text>
              <Text style={styles.ratingCount}> · {business.review_count} отзывов</Text>
            </View>
          )}

          {/* Address */}
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>{business.address}</Text>
          </View>

          {/* Working hours */}
          {todayHours !== null && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🕐</Text>
              <Text style={styles.infoText}>Сегодня: {todayHours}</Text>
            </View>
          )}

          {/* Phone */}
          <Pressable
            style={styles.infoRow}
            onPress={() => void Linking.openURL(`tel:${business.phone}`)}
          >
            <Text style={styles.infoIcon}>📞</Text>
            <Text style={[styles.infoText, styles.infoLink]}>{formatPhone(business.phone)}</Text>
          </Pressable>

          {/* Instagram */}
          {business.instagram_url ? (
            <Pressable
              style={styles.infoRow}
              onPress={() => {
                const url = business.instagram_url;
                if (url) void Linking.openURL(url);
              }}
            >
              <Text style={styles.infoIcon}>📷</Text>
              <Text style={[styles.infoText, styles.infoLink]}>Instagram</Text>
            </Pressable>
          ) : null}

          {/* Website */}
          {business.website_url ? (
            <Pressable
              style={styles.infoRow}
              onPress={() => {
                const url = business.website_url;
                if (url) void Linking.openURL(url);
              }}
            >
              <Text style={styles.infoIcon}>🌐</Text>
              <Text style={[styles.infoText, styles.infoLink]}>{business.website_url}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Mini-map */}
        {business.lat !== null && business.lng !== null ? (
          <MiniMapSection
            lat={business.lat}
            lng={business.lng}
            onYandexMaps={openYandexMaps}
            onTwoGis={openTwoGis}
          />
        ) : null}

        {/* Staff */}
        {business.staff.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Мастера" />
            <View style={styles.staffList}>
              {business.staff.map((member) => (
                <StaffRow
                  key={member.id}
                  staff={member}
                  slots={slots}
                  onBook={handleBooking}
                />
              ))}
            </View>
            <TouchableOpacity
              style={styles.bookAllBtn}
              onPress={() => handleBooking(undefined)}
              activeOpacity={0.8}
            >
              <Text style={styles.bookAllBtnText}>Выбрать мастера и записаться</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Services */}
        {business.services.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Услуги" />
            <View>
              {business.services.map((service) => (
                <ServiceRow key={service.id} service={service} />
              ))}
            </View>
          </View>
        )}

        {/* Reviews */}
        <View style={styles.section}>
          <SectionHeader title="Отзывы" />
          {reviews.length === 0 ? (
            <Text style={styles.noReviews}>Пока нет отзывов</Text>
          ) : (
            <View style={styles.reviewsList}>
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </View>
          )}
          {business.review_count > 3 && (
            <TouchableOpacity style={styles.allReviewsBtn} activeOpacity={0.7}>
              <Text style={styles.allReviewsBtnText}>
                Все отзывы ({business.review_count})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  errorText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  // Header
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  backBtnText: {
    ...typography.h3,
    color: colors.accent,
  },
  headerTitle: {
    flex: 1,
    ...typography.bodyMedium,
    color: colors.text,
  },
  favoriteBtn: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  favoriteIcon: {
    fontSize: 24,
    color: colors.textMuted,
  },
  favoriteIconActive: {
    color: colors.coral,
  },
  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 0,
  },
  // Photos
  photosRow: {
    flexGrow: 0,
  },
  photosContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  photo: {
    width: 280,
    height: 180,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceAlt,
  },
  // Section
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  businessName: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  categoryName: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  ratingStars: {
    fontSize: 14,
    color: colors.amber,
  },
  ratingValue: {
    ...typography.bodyMedium,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  ratingCount: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  infoIcon: {
    fontSize: 15,
    lineHeight: 22,
  },
  infoText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  infoLink: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  // Staff
  staffList: {
    gap: spacing.sm,
  },
  bookAllBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  bookAllBtnText: {
    ...typography.button,
    color: colors.white,
  },
  // Reviews
  reviewsList: {
    gap: spacing.sm,
  },
  noReviews: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  allReviewsBtn: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  allReviewsBtnText: {
    ...typography.label,
    color: colors.text,
  },
});
