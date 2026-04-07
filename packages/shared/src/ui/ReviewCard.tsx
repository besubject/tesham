import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ReviewItemDto } from '../types';
import { borderRadius, colors, spacing, typography } from './theme';

interface ReviewCardProps {
  review: ReviewItemDto;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function renderStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export function ReviewCard({ review }: ReviewCardProps): React.JSX.Element {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{review.user_name_short}</Text>
          <Text style={styles.date}>{formatDate(review.created_at)}</Text>
        </View>
        <Text style={styles.stars}>{renderStars(review.rating)}</Text>
      </View>

      {review.comment ? (
        <Text style={styles.comment}>{review.comment}</Text>
      ) : null}

      {review.reply_text ? (
        <View style={styles.reply}>
          <Text style={styles.replyLabel}>Ответ заведения:</Text>
          <Text style={styles.replyText}>{review.reply_text}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    ...typography.label,
    color: colors.text,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
  },
  stars: {
    fontSize: 13,
    color: colors.amber,
    letterSpacing: 1,
  },
  comment: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  reply: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  replyLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  replyText: {
    ...typography.bodySmall,
    color: colors.text,
  },
});
