import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  apiClient,
  colors,
  ConfirmationModal,
  monoFont,
  spacing,
} from '@mettig/shared';
import type { HomeStackScreenProps } from '../../navigation/types';

type Props = HomeStackScreenProps<'BookingConfirm'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'] as const;
const MONTHS_RU = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'] as const;
const MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'] as const;
const WEEKDAYS_SHORT = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'] as const;

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y as number, (m as number) - 1, d as number);
}

// ─── Detail row ───────────────────────────────────────────────────────────────

interface DetailRowProps { label: string; value: string; last?: boolean }

function DetailRow({ label, value, last = false }: DetailRowProps): React.JSX.Element {
  return (
    <View style={[rowStyles.row, last && rowStyles.rowLast]}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  label: {
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  value: { fontSize: 13, color: colors.text, textAlign: 'right' },
});

// ─── BookingConfirmScreen ─────────────────────────────────────────────────────

export function BookingConfirmScreen({ navigation, route }: Props): React.JSX.Element {
  const { bookingId, businessName, staffName, serviceName, date, startTime, price } = route.params;
  const insets = useSafeAreaInsets();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const handleCancelConfirm = useCallback(async () => {
    setShowCancelModal(false);
    setIsCancelling(true);
    try {
      await apiClient.delete(`/bookings/${bookingId}`);
      setCancelled(true);
    } catch {
      setCancelled(true);
    } finally {
      setIsCancelling(false);
    }
  }, [bookingId]);

  const handleGoHome = useCallback(() => { navigation.popToTop(); }, [navigation]);

  // ── Cancelled ─────────────────────────────────────────────────────────────
  if (cancelled) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.cancelledContent}>
          <View style={styles.cancelledCircle}>
            <Text style={styles.cancelledX}>✕</Text>
          </View>
          <Text style={styles.cancelledTitle}>Запись отменена</Text>
          <Text style={styles.cancelledSub}>Ваша запись в {businessName} была отменена.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleGoHome} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>На главную</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Date objects ──────────────────────────────────────────────────────────
  const dateObj = parseDate(date);
  const dayName = WEEKDAYS[dateObj.getDay()] ?? '';
  const dayShort = WEEKDAYS_SHORT[dateObj.getDay()] ?? '';
  const monthName = MONTHS_RU[dateObj.getMonth()] ?? '';
  const monthShort = MONTHS_SHORT[dateObj.getMonth()] ?? '';
  const dayNum = dateObj.getDate();
  const year = dateObj.getFullYear();

  const startH = startTime.slice(0, 5);
  // approximate end time
  const [hh, mm] = startH.split(':').map(Number);
  const endDate = new Date(dateObj);
  endDate.setHours(hh as number, mm as number);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.topBar}>
          <Text style={styles.pageLabel}>
            <Text style={{ fontFamily: monoFont, fontSize: 10, color: colors.textMuted }}>05 / Подтверждение</Text>
          </Text>
          <Text style={styles.stepLabel}>
            <Text style={{ fontFamily: monoFont, fontSize: 10, color: colors.textMuted }}>3 / 3</Text>
          </Text>
        </View>

        {/* ── Progress (all filled) ── */}
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, styles.progressBarFilled]} />
          <View style={[styles.progressBar, styles.progressBarFilled]} />
          <View style={[styles.progressBar, styles.progressBarFilled]} />
        </View>

        {/* ── Title ── */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            {'Всё верно'}
            <Text style={{ color: colors.accent }}>?</Text>
          </Text>
        </View>

        {/* ── Summary card ── */}
        <View style={styles.cardWrap}>
          <View style={styles.card}>
            {/* Big time + mini calendar */}
            <View style={styles.dateRow}>
              <View style={styles.dateLeft}>
                <Text style={styles.dayLabelMono}>{dayName.charAt(0).toUpperCase() + dayName.slice(1)}</Text>
                <Text style={styles.bigTime}>{startH}</Text>
                <Text style={styles.dateSubText}>{dayNum} {monthName} {year}</Text>
              </View>
              <View style={styles.miniCal}>
                <View style={styles.miniCalMonth}>
                  <Text style={styles.miniCalMonthText}>{monthShort}</Text>
                </View>
                <Text style={styles.miniCalDay}>{dayNum}</Text>
              </View>
            </View>

            {/* Details rows */}
            <View style={styles.detailsBlock}>
              <DetailRow label="Заведение" value={businessName} />
              <DetailRow label="Услуга" value={serviceName} />
              <DetailRow label="Мастер" value={staffName} />
              <DetailRow label="Дата" value={`${dayShort}, ${dayNum} ${monthName}`} />
              <DetailRow label="Время" value={startH} />
            </View>

            {/* Price footer */}
            <View style={styles.priceBar}>
              <Text style={styles.priceLabelMono}>К оплате на месте</Text>
              <Text style={styles.priceVal}>{price.toLocaleString('ru-RU')} ₽</Text>
            </View>
          </View>
        </View>

        {/* ── Policy note ── */}
        <View style={styles.policyWrap}>
          <View style={styles.policyCard}>
            <View style={styles.policyDot} />
            <View style={styles.policyText}>
              <Text style={styles.policyTitle}>Бесплатная отмена до начала дня</Text>
              <Text style={styles.policySub}>
                Напомним за 24 ч и за 2 ч. Опоздание свыше 15 минут — слот может быть передан.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Cancel link ── */}
        <TouchableOpacity
          style={styles.cancelLink}
          onPress={() => setShowCancelModal(true)}
          disabled={isCancelling}
          activeOpacity={0.7}
        >
          {isCancelling ? (
            <ActivityIndicator color={colors.coral} />
          ) : (
            <Text style={styles.cancelLinkText}>Отменить запись</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ── CTA ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleGoHome} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>На главную</Text>
        </TouchableOpacity>
      </View>

      <ConfirmationModal
        visible={showCancelModal}
        title="Отменить запись?"
        message={`Вы уверены, что хотите отменить запись к ${staffName} на ${startH}?`}
        confirmLabel="Да, отменить"
        cancelLabel="Нет, оставить"
        onConfirm={() => void handleCancelConfirm()}
        onCancel={() => setShowCancelModal(false)}
        destructive
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: {},

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  pageLabel: {},
  stepLabel: {},

  // Progress
  progressWrap: { flexDirection: 'row', gap: 6, paddingHorizontal: 18, paddingBottom: 14 },
  progressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border },
  progressBarFilled: { backgroundColor: colors.text },

  // Title
  titleBlock: { paddingHorizontal: 18, paddingBottom: 18 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8, lineHeight: 32, color: colors.text },

  // Card
  cardWrap: { paddingHorizontal: 18, paddingBottom: 14 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateLeft: { gap: 4 },
  dayLabelMono: {
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  bigTime: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 38,
    color: colors.text,
    marginTop: 4,
  },
  dateSubText: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  miniCal: {
    width: 52,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  miniCalMonth: {
    width: '100%',
    backgroundColor: colors.accent,
    paddingVertical: 3,
    alignItems: 'center',
  },
  miniCalMonthText: {
    fontFamily: monoFont,
    fontSize: 9,
    letterSpacing: 1,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  miniCalDay: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.6,
    paddingVertical: 6,
  },
  detailsBlock: {},
  priceBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    backgroundColor: colors.surfaceAlt,
  },
  priceLabelMono: {
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  priceVal: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: colors.text },

  // Policy
  policyWrap: { paddingHorizontal: 18, paddingBottom: 14 },
  policyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentSoft,
    borderRadius: 14,
    padding: 14,
  },
  policyDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: colors.accent,
    marginTop: 5,
    flexShrink: 0,
  },
  policyText: { flex: 1, gap: 4 },
  policyTitle: { fontSize: 12, fontWeight: '600', color: colors.text },
  policySub: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },

  // Cancel link
  cancelLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginHorizontal: 18,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  cancelLinkText: { fontSize: 13, color: colors.coral },

  // Footer
  footer: {
    paddingHorizontal: 18,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
  },
  primaryBtn: {
    backgroundColor: colors.text,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 14, fontWeight: '600', color: colors.surface },

  // Cancelled
  cancelledContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: spacing.md },
  cancelledCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.coralLight,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelledX: { fontSize: 32, color: colors.coral, lineHeight: 40 },
  cancelledTitle: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  cancelledSub: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
