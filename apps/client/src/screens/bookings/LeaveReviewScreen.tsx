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
import { apiClient, colors, monoFont, spacing } from '@mettig/shared';
import type { BookingsStackScreenProps } from '../../navigation/types';

type Props = BookingsStackScreenProps<'LeaveReview'>;

const TAGS = ['Мастер', 'Атмосфера', 'Чистота', 'Удобство записи', 'Цена', 'Вовремя'] as const;

// ─── BlockRating ──────────────────────────────────────────────────────────────

interface BlockRatingProps {
  rating: number;
  onChange: (value: number) => void;
}

function BlockRating({ rating, onChange }: BlockRatingProps): React.JSX.Element {
  return (
    <View style={blockStyles.row}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= rating;
        return (
          <TouchableOpacity
            key={i}
            style={[blockStyles.block, filled ? blockStyles.blockFilled : blockStyles.blockEmpty]}
            onPress={() => onChange(i)}
            activeOpacity={0.75}
            accessibilityLabel={`Оценка ${i}`}
          >
            <Text style={[blockStyles.blockText, filled ? blockStyles.blockTextFilled : blockStyles.blockTextEmpty]}>
              {i}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const blockStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
  },
  block: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockFilled: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  blockEmpty: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  blockText: { fontSize: 14, fontWeight: '600' },
  blockTextFilled: { color: colors.surface },
  blockTextEmpty: { color: colors.textMuted },
});

// ─── LeaveReviewScreen ────────────────────────────────────────────────────────

export function LeaveReviewScreen({ route, navigation }: Props): React.JSX.Element {
  const { bookingId, businessName } = route.params;
  const insets = useSafeAreaInsets();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = rating > 0 && !isSubmitting;

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }, []);

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
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.topBarLeft}>‹  Отзыв</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('BookingsList')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.topBarRight}>пропустить</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 90 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>
              {'Как прошло\nв '}
              <Text>{businessName}</Text>
              <Text style={{ color: colors.accent }}>?</Text>
            </Text>
          </View>

          {/* Rating card */}
          <View style={styles.section}>
            <View style={styles.ratingCard}>
              <View style={styles.ratingHeader}>
                <Text style={styles.ratingBig}>
                  {rating > 0 ? rating : '—'}
                  <Text style={styles.ratingOf}>/5</Text>
                </Text>
                <Text style={styles.ratingLabel}>оценка</Text>
              </View>
              <BlockRating rating={rating} onChange={setRating} />
            </View>
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <Text style={styles.mono}>Что особенно понравилось</Text>
            <View style={styles.tagsWrap}>
              {TAGS.map((tag) => {
                const active = selectedTags.has(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tag, active ? styles.tagActive : styles.tagInactive]}
                    onPress={() => toggleTag(tag)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tagText, active ? styles.tagTextActive : styles.tagTextInactive]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Comment */}
          <View style={styles.section}>
            <View style={styles.commentCard}>
              <Text style={styles.mono}>Комментарий</Text>
              <TextInput
                style={styles.textInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Расскажите о своём визите..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
                textAlignVertical="top"
                editable={!isSubmitting}
                accessibilityLabel="Комментарий к отзыву"
              />
            </View>
            <Text style={styles.charCount}>{comment.length} / 500</Text>
          </View>
        </ScrollView>

        {/* CTA footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TouchableOpacity
            style={[styles.publishBtn, !canSubmit && styles.publishBtnDisabled]}
            onPress={() => void handleSubmit()}
            disabled={!canSubmit}
            activeOpacity={0.85}
            accessibilityLabel="Опубликовать отзыв"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Text style={styles.publishBtnText}>Опубликовать отзыв</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.bg },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  topBarLeft: {
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  topBarRight: {
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },

  scroll: { paddingBottom: 20 },

  titleBlock: { paddingHorizontal: 18, paddingBottom: 14 },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 34,
    color: colors.text,
  },

  section: { paddingHorizontal: 18, paddingBottom: 18 },

  mono: {
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 10,
  },

  // Rating card
  ratingCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  ratingBig: {
    fontSize: 64,
    fontWeight: '700',
    letterSpacing: -3,
    lineHeight: 70,
    color: colors.text,
  },
  ratingOf: {
    fontSize: 32,
    fontWeight: '400',
    color: colors.textMuted,
    letterSpacing: -1,
  },
  ratingLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },

  // Tags
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  tagActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  tagInactive: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  tagText: { fontSize: 12, fontWeight: '500' },
  tagTextActive: { color: colors.surface },
  tagTextInactive: { color: colors.text },

  // Comment
  commentCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    minHeight: 120,
  },
  textInput: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    marginTop: 8,
    minHeight: 80,
  },
  charCount: {
    fontFamily: monoFont,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 6,
  },

  // Footer
  footer: {
    paddingHorizontal: 18,
    paddingTop: spacing.sm,
    backgroundColor: colors.bg,
  },
  publishBtn: {
    backgroundColor: colors.text,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtnDisabled: {
    backgroundColor: colors.border,
  },
  publishBtnText: { fontSize: 14, fontWeight: '600', color: colors.surface },
});
