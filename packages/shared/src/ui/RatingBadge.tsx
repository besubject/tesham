import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from './theme';

interface RatingBadgeProps {
  rating: number | null;
  reviewCount?: number;
  size?: 'sm' | 'md';
}

export function RatingBadge({ rating, reviewCount, size = 'md' }: RatingBadgeProps): React.JSX.Element {
  if (rating === null) {
    return (
      <View style={[styles.badge, styles.empty, size === 'sm' && styles.badgeSm]}>
        <Text style={[styles.text, size === 'sm' && styles.textSm, styles.emptyText]}>Нет оценок</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, size === 'sm' && styles.badgeSm]}>
      <Text style={styles.star}>★</Text>
      <Text style={[styles.text, size === 'sm' && styles.textSm]}>
        {rating.toFixed(1)}
      </Text>
      {reviewCount !== undefined && (
        <Text style={[styles.count, size === 'sm' && styles.countSm]}>
          {' '}({reviewCount})
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amberLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  empty: {
    backgroundColor: colors.surfaceAlt,
  },
  star: {
    fontSize: 12,
    color: colors.amber,
    marginRight: 2,
  },
  text: {
    ...typography.label,
    color: colors.text,
  },
  textSm: {
    ...typography.caption,
  },
  count: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  countSm: {
    ...typography.caption,
  },
  emptyText: {
    color: colors.textMuted,
  },
});
