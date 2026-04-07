import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient, borderRadius, colors, spacing, typography } from '@mettig/shared';
import type { BookingsStackScreenProps } from '../../navigation/types';

type Props = BookingsStackScreenProps<'LeaveReview'>;

const STAR_COUNT = 5;

// ─── StarRating ───────────────────────────────────────────────────────────────

interface StarRatingProps {
  rating: number;
  onChange: (value: number) => void;
}

function StarRating({ rating, onChange }: StarRatingProps): React.JSX.Element {
  return (
    <View style={starStyles.row} accessibilityLabel={`Рейтинг: ${rating} из 5`}>
      {Array.from({ length: STAR_COUNT }, (_, i) => {
        const starValue = i + 1;
        const filled = starValue <= rating;
        return (
          <TouchableOpacity
            key={starValue}
            onPress={() => onChange(starValue)}
            accessibilityLabel={`${starValue} звезд`}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={[starStyles.star, filled ? starStyles.filled : starStyles.empty]}>
              {filled ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  star: {
    fontSize: 40,
    lineHeight: 48,
  },
  filled: {
    color: colors.amber,
  },
  empty: {
    color: colors.borderStrong,
  },
});

// ─── LeaveReviewScreen ────────────────────────────────────────────────────────

export function LeaveReviewScreen({ route, navigation }: Props): React.JSX.Element {
  const { bookingId, businessName } = route.params;
  const insets = useSafeAreaInsets();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = rating > 0 && !isSubmitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await apiClient.post('/reviews', {
        booking_id: bookingId,
        rating,
        text: comment.trim() || undefined,
      });
      navigation.navigate('BookingsList');
    } catch (err: unknown) {
      const message =
        err != null &&
        typeof err === 'object' &&
        'response' in err &&
        err.response != null &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data != null &&
        typeof err.response.data === 'object' &&
        'error' in err.response.data &&
        err.response.data.error != null &&
        typeof err.response.data.error === 'object' &&
        'message' in err.response.data.error &&
        typeof err.response.data.error.message === 'string'
          ? err.response.data.error.message
          : 'Не удалось отправить отзыв. Попробуйте ещё раз.';
      Alert.alert('Ошибка', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, bookingId, rating, comment, navigation]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
            <Text style={styles.screenTitle}>Оставить отзыв</Text>
            <Text style={styles.screenSubtitle} numberOfLines={1}>
              {businessName}
            </Text>
          </View>
        </View>

        {/* Form */}
        <ScrollView
          contentContainerStyle={[
            styles.formContent,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Stars */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Ваша оценка</Text>
            <View style={styles.starsContainer}>
              <StarRating rating={rating} onChange={setRating} />
              {rating > 0 && (
                <Text style={styles.ratingHint}>{ratingLabel(rating)}</Text>
              )}
            </View>
          </View>

          {/* Comment */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Комментарий (необязательно)</Text>
            <TextInput
              style={styles.textInput}
              value={comment}
              onChangeText={setComment}
              placeholder="Расскажите о своём визите..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
              textAlignVertical="top"
              accessibilityLabel="Комментарий к отзыву"
            />
            <Text style={styles.charCount}>{comment.length}/1000</Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={() => void handleSubmit()}
            disabled={!canSubmit}
            accessibilityLabel="Отправить отзыв"
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.submitBtnText}>Отправить</Text>
            )}
          </TouchableOpacity>

          {rating === 0 && (
            <Text style={styles.hintText}>Выберите оценку, чтобы отправить отзыв</Text>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function ratingLabel(rating: number): string {
  switch (rating) {
    case 1:
      return 'Очень плохо';
    case 2:
      return 'Плохо';
    case 3:
      return 'Нормально';
    case 4:
      return 'Хорошо';
    case 5:
      return 'Отлично!';
    default:
      return '';
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  formContent: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  starsContainer: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  ratingHint: {
    ...typography.bodyMedium,
    color: colors.amber,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    minHeight: 120,
  },
  charCount: {
    ...typography.caption,
    color: colors.textMuted,
    alignSelf: 'flex-end',
  },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    ...typography.button,
    color: colors.white,
  },
  hintText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
