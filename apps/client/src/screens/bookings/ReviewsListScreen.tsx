import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient, ReviewCard, borderRadius, colors, spacing, typography } from '@mettig/shared';
import type { ReviewItemDto } from '@mettig/shared';
import type { BookingsStackScreenProps } from '../../navigation/types';

type Props = BookingsStackScreenProps<'ReviewsList'>;

const PAGE_SIZE = 20;

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState(): React.JSX.Element {
  return (
    <View style={emptyStyles.container}>
      <Text style={emptyStyles.icon}>⭐</Text>
      <Text style={emptyStyles.title}>Нет отзывов</Text>
      <Text style={emptyStyles.subtitle}>Пока никто не оставил отзыв об этом заведении</Text>
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

// ─── ReviewsListScreen ────────────────────────────────────────────────────────

export function ReviewsListScreen({ route, navigation }: Props): React.JSX.Element {
  const { businessId, businessName } = route.params;
  const insets = useSafeAreaInsets();

  const [reviews, setReviews] = useState<ReviewItemDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchReviews = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (replace) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      try {
        const res = await apiClient.get<{
          data: ReviewItemDto[];
          pagination: { page: number; limit: number; total: number };
        }>(`/businesses/${businessId}/reviews?page=${pageNum}&limit=${PAGE_SIZE}`);
        setTotal(res.data.pagination.total);
        setReviews((prev) => (replace ? res.data.data : [...prev, ...res.data.data]));
        setPage(pageNum);
      } catch {
        // keep existing state on error
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [businessId],
  );

  useEffect(() => {
    void fetchReviews(1, true);
  }, [fetchReviews]);

  const handleLoadMore = useCallback(() => {
    const hasMore = reviews.length < total;
    if (hasMore && !isLoadingMore) {
      void fetchReviews(page + 1, false);
    }
  }, [reviews.length, total, isLoadingMore, fetchReviews, page]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Назад"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.screenTitle}>Отзывы</Text>
          <Text style={styles.screenSubtitle} numberOfLines={1}>
            {businessName}
          </Text>
        </View>
        {total > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{total}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          ListEmptyComponent={<EmptyState />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ReviewCard review={item} />
            </View>
          )}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : null
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  backBtn: {
    padding: spacing.xs,
  },
  backIcon: {
    fontSize: 22,
    color: colors.text,
    lineHeight: 26,
  },
  headerTitles: {
    flex: 1,
    gap: 2,
  },
  screenTitle: {
    ...typography.h3,
    color: colors.text,
  },
  screenSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  countBadge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 28,
    alignItems: 'center',
  },
  countText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingTop: spacing.md,
  },
  cardWrapper: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
