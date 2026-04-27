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
  BusinessDetailDto,
  colors,
  monoFont,
  PaginatedResponseDto,
  ReviewItemDto,
  ServiceItemDto,
  SlotItemDto,
  spacing,
  StaffItemDto,
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

function isOpenNow(hours: Record<string, { open: string; close: string } | null>): boolean {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const day = days[new Date().getDay()];
  if (!day) return false;
  return hours[day] != null;
}

// ─── MonoLabel ────────────────────────────────────────────────────────────────

function MonoLabel({ children, style }: { children: string; style?: object }): React.JSX.Element {
  return <Text style={[monoStyle, style]}>{children}</Text>;
}
const monoStyle = {
  fontFamily: monoFont,
  fontSize: 10,
  letterSpacing: 0.6,
  textTransform: 'uppercase' as const,
  color: colors.textMuted,
};

// ─── Service card ─────────────────────────────────────────────────────────────

interface ServiceCardProps {
  service: ServiceItemDto;
  selected: boolean;
  onSelect: () => void;
}

function ServiceCard({ service, selected, onSelect }: ServiceCardProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[svcStyles.card, selected && svcStyles.cardSelected]}
      onPress={onSelect}
      activeOpacity={0.75}
    >
      <View style={svcStyles.left}>
        <Text style={[svcStyles.name, selected && svcStyles.textInverted]}>{service.name}</Text>
        <Text style={[svcStyles.dur, selected && svcStyles.durInverted]}>
          {service.duration_minutes} мин
        </Text>
      </View>
      <View style={svcStyles.right}>
        <Text style={[svcStyles.price, selected && svcStyles.textInverted]}>
          {service.price.toLocaleString('ru-RU')} ₽
        </Text>
        <View style={[svcStyles.checkBox, selected && svcStyles.checkBoxSelected]}>
          <Text style={[svcStyles.checkIcon, selected && svcStyles.checkIconSelected]}>
            {selected ? '✓' : '+'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const svcStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  cardSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  left: { flex: 1, gap: 4 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  dur: { fontFamily: monoFont, fontSize: 10, color: colors.textMuted, letterSpacing: 0.4 },
  price: { fontSize: 14, fontWeight: '600', color: colors.text },
  textInverted: { color: colors.surface },
  durInverted: { color: 'rgba(251,250,246,0.55)' },
  checkBox: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxSelected: {
    backgroundColor: colors.surface,
    borderColor: colors.surface,
  },
  checkIcon: { fontSize: 13, color: colors.textMuted },
  checkIconSelected: { color: colors.text },
});

// ─── Staff row ────────────────────────────────────────────────────────────────

interface StaffRowProps {
  staff: StaffItemDto;
  slots: SlotItemDto[];
  onBook: (staffId: string) => void;
}

function StaffRow({ staff, onBook }: StaffRowProps): React.JSX.Element {
  return (
    <View style={staffStyles.row}>
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
  );
}

const staffStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: 8,
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  role: { fontFamily: monoFont, fontSize: 10, color: colors.textMuted, letterSpacing: 0.4 },
  bookBtn: {
    backgroundColor: colors.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bookBtnText: { fontSize: 12, fontWeight: '600', color: colors.surface },
});

// ─── Review item ──────────────────────────────────────────────────────────────

function ReviewItem({ review }: { review: ReviewItemDto }): React.JSX.Element {
  return (
    <View style={revStyles.card}>
      <View style={revStyles.header}>
        <Text style={revStyles.author}>{review.user_name_short ?? 'Аноним'}</Text>
        <MonoLabel>{`${review.rating}/5`}</MonoLabel>
      </View>
      {review.comment != null && (
        <Text style={revStyles.text}>{review.comment}</Text>
      )}
    </View>
  );
}

const revStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 6,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  author: { fontSize: 13, fontWeight: '600', color: colors.text },
  text: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
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
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined);

  // ── Load ───────────────────────────────────────────────────────────────────
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

  // ── Favorite ───────────────────────────────────────────────────────────────
  const handleFavoriteToggle = useCallback(async () => {
    if (isTogglingFavorite) return;
    setIsTogglingFavorite(true);
    try {
      if (isFavorite && favoriteId) {
        await apiClient.delete(`/favorites/${favoriteId}`);
        setIsFavorite(false);
        setFavoriteId(null);
      } else {
        const res = await apiClient.post<{ id: string }>('/favorites', { business_id: businessId });
        setIsFavorite(true);
        setFavoriteId(res.data.id);
      }
    } catch {
      setIsFavorite((prev) => !prev);
    } finally {
      setIsTogglingFavorite(false);
    }
  }, [isFavorite, favoriteId, businessId, isTogglingFavorite]);

  // ── Maps ───────────────────────────────────────────────────────────────────
  const openYandexMaps = useCallback((lat: number, lng: number) => {
    const marker = `${lng},${lat},pm2rdm`;
    const deep = `yandexmaps://maps.yandex.ru/?ll=${lng},${lat}&z=17&pt=${marker}`;
    const web = `https://yandex.ru/maps/?ll=${lng},${lat}&z=17&pt=${marker}`;
    Linking.canOpenURL(deep).then((s) => Linking.openURL(s ? deep : web)).catch(() => Linking.openURL(web));
  }, []);

  const openTwoGis = useCallback((lat: number, lng: number) => {
    const deep = `dgis://2gis.ru/routeSearch/rsType/car/to/${lng},${lat}`;
    const web = `https://2gis.ru/routeSearch/rsType/car/to/${lng},${lat}`;
    Linking.canOpenURL(deep).then((s) => Linking.openURL(s ? deep : web)).catch(() => Linking.openURL(web));
  }, []);

  // ── Booking ────────────────────────────────────────────────────────────────
  const handleBooking = useCallback(
    (staffId?: string) => {
      navigation.navigate('BookingSlots', { businessId, staffId });
    },
    [navigation, businessId],
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.errorText}>Не удалось загрузить данные</Text>
      </View>
    );
  }

  const open = isOpenNow(business.working_hours as Record<string, { open: string; close: string } | null>);
  const todayHours = todayWorkingHours(business.working_hours as Record<string, { open: string; close: string } | null>);
  const minPrice = business.services.length > 0
    ? Math.min(...business.services.map((s) => s.price))
    : null;
  const selectedService = business.services.find((s) => s.id === selectedServiceId);

  const ctaLabel = selectedService != null
    ? `Выбрать слот · ${selectedService.price.toLocaleString('ru-RU')} ₽ →`
    : minPrice != null
      ? `Выбрать слот · от ${minPrice.toLocaleString('ru-RU')} ₽ →`
      : 'Выбрать слот →';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero photo ── */}
        <View style={styles.heroWrap}>
          {business.photos.length > 0 ? (
            <Image source={{ uri: business.photos[0] }} style={styles.heroPhoto} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder} />
          )}
          {/* back + fav buttons over photo */}
          <View style={[styles.photoOverlay, { top: 10 }]}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Text style={styles.iconBtnText}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => void handleFavoriteToggle()}
              activeOpacity={0.8}
            >
              <Text style={styles.iconBtnText}>{isFavorite ? '♥' : '♡'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Title block ── */}
        <View style={styles.titleBlock}>
          <View style={styles.statusRow}>
            <MonoLabel style={{ color: open ? colors.ok : colors.textMuted }}>
              {open ? `● открыто${todayHours ? ' до ' + todayHours.split('–')[1]?.trim() : ''}` : '○ закрыто'}
            </MonoLabel>
            <MonoLabel>{`  · ${business.category_name_ru}`}</MonoLabel>
          </View>
          <Text style={styles.businessName}>{business.name}</Text>
          <Text style={styles.address}>{business.address}</Text>

          {/* Metrics row */}
          <View style={styles.metricsRow}>
            {business.avg_rating != null && (
              <>
                <View style={styles.metricCell}>
                  <Text style={styles.metricNum}>{Number(business.avg_rating).toFixed(1)}</Text>
                  <MonoLabel>рейтинг</MonoLabel>
                </View>
                <View style={styles.metricSep} />
              </>
            )}
            {business.review_count > 0 && (
              <>
                <View style={[styles.metricCell, styles.metricCenter]}>
                  <Text style={styles.metricNum}>{business.review_count}</Text>
                  <MonoLabel>отзывов</MonoLabel>
                </View>
                <View style={styles.metricSep} />
              </>
            )}
            {todayHours != null && (
              <View style={[styles.metricCell, styles.metricRight]}>
                <Text style={styles.metricNum}>{todayHours}</Text>
                <MonoLabel>сегодня</MonoLabel>
              </View>
            )}
          </View>
        </View>

        {/* ── Services ── */}
        {business.services.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Услуги</Text>
              <MonoLabel>{`${business.services.length} опций`}</MonoLabel>
            </View>
            {business.services.map((svc) => (
              <ServiceCard
                key={svc.id}
                service={svc}
                selected={selectedServiceId === svc.id}
                onSelect={() => setSelectedServiceId((prev) => prev === svc.id ? undefined : svc.id)}
              />
            ))}
          </View>
        )}

        {/* ── Staff ── */}
        {business.staff.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Мастера</Text>
            </View>
            {business.staff.map((member) => (
              <StaffRow key={member.id} staff={member} slots={slots} onBook={handleBooking} />
            ))}
          </View>
        )}

        {/* ── Navigation ── */}
        {business.lat != null && business.lng != null && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Навигация</Text>
            </View>
            <View style={styles.navRow}>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => openYandexMaps(business.lat as number, business.lng as number)}
                activeOpacity={0.8}
              >
                <Text style={styles.navBtnText}>Яндекс.Карты</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => openTwoGis(business.lat as number, business.lng as number)}
                activeOpacity={0.8}
              >
                <Text style={styles.navBtnText}>2ГИС</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Contacts ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Контакты</Text>
          </View>
          <Pressable onPress={() => void Linking.openURL(`tel:${business.phone}`)} style={styles.contactRow}>
            <MonoLabel>телефон</MonoLabel>
            <Text style={styles.contactVal}>{formatPhone(business.phone)}</Text>
          </Pressable>
          {business.instagram_url != null && (
            <Pressable onPress={() => void Linking.openURL(business.instagram_url!)} style={styles.contactRow}>
              <MonoLabel>instagram</MonoLabel>
              <Text style={[styles.contactVal, styles.contactLink]}>@instagram</Text>
            </Pressable>
          )}
          {business.website_url != null && (
            <Pressable onPress={() => void Linking.openURL(business.website_url!)} style={styles.contactRow}>
              <MonoLabel>сайт</MonoLabel>
              <Text style={[styles.contactVal, styles.contactLink]}>{business.website_url}</Text>
            </Pressable>
          )}
        </View>

        {/* ── Reviews ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Отзывы</Text>
            {business.review_count > 0 && (
              <MonoLabel>{`${business.review_count} всего`}</MonoLabel>
            )}
          </View>
          {reviews.length === 0 ? (
            <Text style={styles.noReviews}>Пока нет отзывов</Text>
          ) : (
            reviews.map((r) => <ReviewItem key={r.id} review={r} />)
          )}
        </View>
      </ScrollView>

      {/* ── CTA button ── */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => handleBooking(undefined)}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaBtnText}>{ctaLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { gap: 0 },

  // Hero
  heroWrap: { position: 'relative', margin: 14, borderRadius: 18, overflow: 'hidden' },
  heroPhoto: { width: '100%', height: 260 },
  heroPlaceholder: {
    height: 260,
    backgroundColor: '#e7e3d6',
  },
  photoOverlay: {
    position: 'absolute',
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 18, color: colors.text, lineHeight: 22 },

  // Title block
  titleBlock: { paddingHorizontal: 18, paddingBottom: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  businessName: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8, lineHeight: 32, color: colors.text, marginBottom: 6 },
  address: { fontSize: 13, color: colors.textSecondary, marginBottom: 14 },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  metricCell: { paddingHorizontal: 8, gap: 4 },
  metricCenter: { flex: 1, alignItems: 'center' },
  metricRight: { flex: 1, alignItems: 'flex-end', paddingRight: 0 },
  metricNum: { fontSize: 20, fontWeight: '600', color: colors.text, letterSpacing: -0.4 },
  metricSep: { width: 1, backgroundColor: colors.border, alignSelf: 'stretch' },

  // Sections
  section: { paddingHorizontal: 18, paddingVertical: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.text },

  // Contacts
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contactVal: { fontSize: 14, color: colors.text },
  contactLink: { color: colors.accent, textDecorationLine: 'underline' },

  // Navigation buttons
  navRow: { flexDirection: 'row', gap: spacing.sm },
  navBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  navBtnText: { fontSize: 13, fontWeight: '500', color: colors.text },

  // Reviews
  noReviews: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },

  // Error / back
  backBtn: { padding: spacing.sm },
  backBtnText: { fontSize: 17, color: colors.accent },
  errorText: { fontSize: 14, color: colors.textMuted, marginTop: spacing.md },

  // CTA
  ctaBar: {
    paddingHorizontal: 18,
    paddingTop: 14,
    marginBottom: 50,
    backgroundColor: colors.bg,
    borderTopWidth: 0,
  },
  ctaBtn: {
    backgroundColor: colors.text,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: { fontSize: 14, fontWeight: '600', color: colors.surface },
});
