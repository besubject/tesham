import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BusinessListItemDto } from '../types';
import { RatingBadge } from './RatingBadge';
import { StatusBadge } from './StatusBadge';
import { borderRadius, colors, shadow, spacing, typography } from './theme';

interface BusinessCardProps {
  business: BusinessListItemDto;
  onPress?: () => void;
  isOpen?: boolean;
}

function formatDistance(meters: number | null): string | null {
  if (meters === null) return null;
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

export function BusinessCard({ business, onPress, isOpen }: BusinessCardProps): React.JSX.Element {
  const distance = formatDistance(business.distance_m);
  const thumbnail = business.photos[0];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={`${business.name}, ${business.address}`}
      accessibilityRole="button"
    >
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderIcon}>{business.category_icon}</Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{business.name}</Text>
          {isOpen !== undefined && (
            <StatusBadge status={isOpen ? 'open' : 'closed'} />
          )}
        </View>

        <Text style={styles.category} numberOfLines={1}>
          {business.category_icon} {business.category_name_ru}
        </Text>

        <Text style={styles.address} numberOfLines={1}>{business.address}</Text>

        <View style={styles.footer}>
          <RatingBadge
            rating={business.avg_rating}
            reviewCount={business.review_count}
            size="sm"
          />
          {distance && (
            <Text style={styles.distance}>{distance}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  image: {
    width: '100%',
    height: 140,
    backgroundColor: colors.surfaceAlt,
  },
  imagePlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderIcon: {
    fontSize: 40,
  },
  content: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  category: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  address: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  distance: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
