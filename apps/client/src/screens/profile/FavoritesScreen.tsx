import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  apiClient,
  colors,
  typography,
  spacing,
  borderRadius,
  type FavoriteBusinessItemDto,
  type FavoriteStaffItemDto,
  type GetFavoritesResponseDto,
} from '@mettig/shared';
import type { ProfileStackScreenProps } from '../../navigation/types';

type Props = ProfileStackScreenProps<'Favorites'>;

type FavoriteItem =
  | { type: 'business'; data: FavoriteBusinessItemDto }
  | { type: 'staff'; data: FavoriteStaffItemDto };

// ─── Empty state ──────────────────────────────────────────────────────────

function EmptyState(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <View style={emptyStyles.container}>
      <Text style={emptyStyles.icon}>⭐</Text>
      <Text style={emptyStyles.title}>{t('profile.noFavorites')}</Text>
      <Text style={emptyStyles.subtitle}>
        {t('profile.noFavoritesHint')}
      </Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
    gap: spacing.md,
  },
  icon: {
    fontSize: 48,
    lineHeight: 56,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});

// ─── Item renderer ────────────────────────────────────────────────────────

function FavoriteBusinessItem({ item }: { item: FavoriteBusinessItemDto }): React.JSX.Element {
  return (
    <View style={itemStyles.container}>
      <View style={itemStyles.content}>
        <Text style={itemStyles.name} numberOfLines={1}>
          {item.business_name}
        </Text>
        <Text style={itemStyles.category} numberOfLines={1}>
          {item.category_name_ru}
        </Text>
        <Text style={itemStyles.address} numberOfLines={1}>
          {item.business_address}
        </Text>
      </View>
    </View>
  );
}

function FavoriteStaffItem({ item }: { item: FavoriteStaffItemDto }): React.JSX.Element {
  return (
    <View style={itemStyles.container}>
      <View style={itemStyles.avatar}>
        {item.staff_avatar_url ? (
          <Text>👨</Text>
        ) : (
          <Text style={itemStyles.avatarPlaceholder}>👤</Text>
        )}
      </View>
      <View style={itemStyles.content}>
        <Text style={itemStyles.name} numberOfLines={1}>
          {item.staff_name}
        </Text>
        <Text style={itemStyles.category} numberOfLines={1}>
          {item.business_name}
        </Text>
      </View>
    </View>
  );
}

const itemStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 20,
  },
  avatarPlaceholder: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  category: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  address: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────

export function FavoritesScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchFavorites = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const { data } = await apiClient.get<GetFavoritesResponseDto>('/favorites');
      const allItems: FavoriteItem[] = [
        ...data.businesses.map((b) => ({ type: 'business' as const, data: b })),
        ...data.staff.map((s) => ({ type: 'staff' as const, data: s })),
      ];
      setItems(allItems);
    } catch {
      // keep existing state on error
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchFavorites();
  }, [fetchFavorites]);

  // ── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>‹ {t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>{t('profile.favorites')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backButton}>‹ {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>{t('profile.favorites')}</Text>
      </View>

      {/* Content */}
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList<FavoriteItem>
          data={items}
          keyExtractor={(item) => `${item.type}-${item.data.id}`}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          renderItem={({ item }) => {
            if (item.type === 'business') {
              return <FavoriteBusinessItem item={item.data} />;
            }
            return <FavoriteStaffItem item={item.data} />;
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void fetchFavorites(true)}
              tintColor={colors.accent}
            />
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
    gap: spacing.sm,
  },
  backButton: {
    ...typography.body,
    color: colors.accent,
  },
  screenTitle: {
    ...typography.h2,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    flexGrow: 1,
  },
});
