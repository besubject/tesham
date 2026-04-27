import React, { useCallback, useEffect } from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@mettig/shared';
import { trackEvent } from '@mettig/shared/src/utils/track-event';
import { useAnalyticsStore, type AnalyticsPeriod } from '../../store/analytics-store';
import type { AnalyticsStackScreenProps } from '../../navigation/types';

// ─── API types ────────────────────────────────────────────────────────────────

interface AnalyticsDashboard {
  period: AnalyticsPeriod;
  date_from: string;
  date_to: string;
  occupancy: {
    percent: number;
    busy_minutes: number;
    total_minutes: number;
  };
  bookings: {
    count: number;
    sum_planned: number;
    by_source: {
      app: number;
      walk_in: number;
      link: number;
    };
  };
  clients: {
    visited: number;
    new: number;
    total: number;
    segments: {
      regulars: number;
      sleeping: number;
      lost: number;
      not_visited: number;
    };
  };
}

type Props = AnalyticsStackScreenProps<'AnalyticsMain'>;

// ─── Period helpers ───────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  day: 'Сегодня',
  week: 'Неделя',
  month: 'Месяц',
};

const PERIODS: AnalyticsPeriod[] = ['day', 'week', 'month'];

function formatPeriodSubtitle(period: AnalyticsPeriod, dateFrom: string, dateTo: string): string {
  const RU_MONTHS = [
    'янв.', 'фев.', 'мар.', 'апр.', 'май', 'июн.',
    'июл.', 'авг.', 'сен.', 'окт.', 'ноя.', 'дек.',
  ];

  const parseDate = (s: string): Date => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d);
  };

  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);

  if (period === 'day') {
    return `Сегодня, ${from.getDate()} ${RU_MONTHS[from.getMonth()]}`;
  }
  if (period === 'week') {
    return `Неделя ${from.getDate()}–${to.getDate()} ${RU_MONTHS[to.getMonth()]}`;
  }
  const year = from.getFullYear();
  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];
  return `${monthNames[from.getMonth()]} ${year}`;
}

// ─── Gauge ────────────────────────────────────────────────────────────────────

interface GaugeProps {
  percent: number;
}

function SemicircularGauge({ percent }: GaugeProps): React.JSX.Element {
  const clampedPct = Math.max(0, Math.min(100, percent));
  // Gauge: 180° arc. We use two half-circle views with rotation.
  const filledColor = '#1D6B4F';
  const emptyColor = '#E8E8E4';
  const size = 140;
  const borderW = 14;

  // degrees to rotate the right half: 0%=0°, 100%=180°
  // Left half always visible for pct > 50
  const pctRotation = (clampedPct / 100) * 180;

  return (
    <View style={{ alignItems: 'center', marginVertical: 8 }}>
      <View style={{ width: size, height: size / 2, overflow: 'hidden' }}>
        {/* Base circle (empty color) */}
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: borderW,
            borderColor: emptyColor,
            position: 'absolute',
          }}
        />
        {/* Filled portion — right half */}
        <View style={{ width: size / 2, height: size, overflow: 'hidden', position: 'absolute', left: size / 2 }}>
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: borderW,
              borderColor: clampedPct > 0 ? filledColor : emptyColor,
              position: 'absolute',
              left: -size / 2,
              transform: [{ rotate: `${Math.min(pctRotation, 180)}deg` }],
            }}
          />
        </View>
        {/* Filled portion — left half (only when > 50%) */}
        {clampedPct > 50 && (
          <View style={{ width: size / 2, height: size, overflow: 'hidden', position: 'absolute' }}>
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: borderW,
                borderColor: filledColor,
                position: 'absolute',
                transform: [{ rotate: `${pctRotation - 180}deg` }],
              }}
            />
          </View>
        )}
      </View>
      {/* Percent label */}
      <View style={{ marginTop: -8, alignItems: 'center' }}>
        <Text style={styles.gaugePercent}>{clampedPct}%</Text>
        <Text style={styles.gaugeLabel}>занято</Text>
      </View>
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBlock({ height }: { height: number }): React.JSX.Element {
  return (
    <View
      style={{
        height,
        borderRadius: 12,
        backgroundColor: '#E8E8E4',
        marginBottom: 16,
      }}
    />
  );
}

// ─── Source bar ───────────────────────────────────────────────────────────────

interface SourceBarProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

function SourceBar({ label, count, total, color }: SourceBarProps): React.JSX.Element {
  const ratio = total > 0 ? count / total : 0;
  return (
    <View style={styles.sourceBarRow}>
      <View style={[styles.sourceDot, { backgroundColor: color }]} />
      <Text style={styles.sourceBarLabel}>{label}</Text>
      <View style={styles.sourceBarTrack}>
        <View style={[styles.sourceBarFill, { flex: ratio, backgroundColor: color }]} />
        <View style={{ flex: 1 - ratio }} />
      </View>
      <Text style={styles.sourceBarCount}>{count}</Text>
    </View>
  );
}

// ─── Segment row ──────────────────────────────────────────────────────────────

const SEGMENT_COLORS: Record<string, string> = {
  regulars: '#1D6B4F',
  sleeping: '#B07415',
  lost: '#C4462A',
  not_visited: '#8A8A86',
};

interface SegmentRowProps {
  label: string;
  segmentKey: string;
  count: number;
  total: number;
  onPress: (segmentKey: string) => void;
}

function SegmentRow({ label, segmentKey, count, total, onPress }: SegmentRowProps): React.JSX.Element {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = SEGMENT_COLORS[segmentKey] ?? '#8A8A86';
  return (
    <TouchableOpacity
      style={styles.segmentRow}
      onPress={() => onPress(segmentKey)}
      accessibilityLabel={`Сегмент ${label}`}
    >
      <View style={[styles.segmentDot, { backgroundColor: color }]} />
      <Text style={styles.segmentLabel}>{label}</Text>
      <Text style={styles.segmentCount}>{count}</Text>
      <Text style={styles.segmentPct}>{pct}%</Text>
    </TouchableOpacity>
  );
}

// ─── AnalyticsScreen ──────────────────────────────────────────────────────────

export function AnalyticsScreen({ navigation }: Props): React.JSX.Element {
  const period = useAnalyticsStore((s) => s.period);
  const setPeriod = useAnalyticsStore((s) => s.setPeriod);
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['analytics-dashboard', period, today],
    queryFn: async () => {
      const { data: resp } = await apiClient.get<{ dashboard: AnalyticsDashboard }>(
        '/business/analytics/dashboard',
        { params: { period, date: today } },
      );
      return resp.dashboard;
    },
    staleTime: 30_000,
  });

  // Track screen open once on mount
  const initialPeriodRef = React.useRef(period);
  useEffect(() => {
    void trackEvent({ event_type: 'analytics_dashboard_opened', payload: { period: initialPeriodRef.current } });
  }, []);

  const handlePeriodChange = useCallback(
    (p: AnalyticsPeriod) => {
      if (p === period) return;
      setPeriod(p);
      void trackEvent({ event_type: 'analytics_period_changed', payload: { period: p } });
    },
    [period, setPeriod],
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'] });
    void refetch();
  }, [queryClient, refetch]);

  const handleSegmentPress = useCallback(
    (segment: string) => {
      navigation.navigate('ClientsScreen', { segment });
    },
    [navigation],
  );

  // ── Subtitle ────────────────────────────────────────────────────────────────
  const subtitle =
    data != null
      ? formatPeriodSubtitle(period, data.date_from, data.date_to)
      : '';

  // ── Empty state: no bookings at all ─────────────────────────────────────────
  const isEmpty =
    !isLoading &&
    data != null &&
    data.bookings.count === 0 &&
    data.clients.total === 0;

  // ── Derived totals for sources ───────────────────────────────────────────────
  const totalSource =
    data != null
      ? data.bookings.by_source.app + data.bookings.by_source.walk_in + data.bookings.by_source.link
      : 0;

  const totalSegments =
    data != null
      ? data.clients.segments.regulars +
        data.clients.segments.sleeping +
        data.clients.segments.lost +
        data.clients.segments.not_visited
      : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Аналитика</Text>
        {subtitle.length > 0 && (
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        )}
      </View>

      {/* Period switcher */}
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodChip, period === p && styles.periodChipActive]}
            onPress={() => handlePeriodChange(p)}
            accessibilityLabel={`Период ${PERIOD_LABELS[p]}`}
          >
            <Text style={[styles.periodChipText, period === p && styles.periodChipTextActive]}>
              {PERIOD_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Loading state */}
      {isLoading && !isRefetching ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <SkeletonBlock height={180} />
          <SkeletonBlock height={130} />
          <SkeletonBlock height={160} />
        </ScrollView>
      ) : error != null && data == null ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Не удалось загрузить аналитику</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => void refetch()}
            accessibilityLabel="Повторить загрузку"
          >
            <Text style={styles.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : isEmpty ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>Нет данных пока</Text>
          <Text style={styles.emptyHint}>Создайте первую запись, чтобы увидеть аналитику</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor="#1D6B4F"
              colors={['#1D6B4F']}
            />
          }
        >
          {/* ── Occupancy block ─────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Загруженность</Text>
            <View style={styles.card}>
              <SemicircularGauge percent={data?.occupancy.percent ?? 0} />
            </View>
          </View>

          {/* ── Bookings block ──────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Записи</Text>
            <View style={styles.card}>
              {/* Two big metrics */}
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{data?.bookings.count ?? 0}</Text>
                  <Text style={styles.metricLabel}>записей</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>
                    {data != null ? `${data.bookings.sum_planned.toLocaleString('ru')} ₽` : '—'}
                  </Text>
                  <Text style={styles.metricLabel}>план</Text>
                </View>
              </View>

              {/* Source bars */}
              {totalSource > 0 && (
                <View style={styles.sourceBars}>
                  <SourceBar
                    label="Из Mettig"
                    count={data?.bookings.by_source.app ?? 0}
                    total={totalSource}
                    color="#1D6B4F"
                  />
                  <SourceBar
                    label="Walk-in"
                    count={data?.bookings.by_source.walk_in ?? 0}
                    total={totalSource}
                    color="#B07415"
                  />
                  {(data?.bookings.by_source.link ?? 0) > 0 && (
                    <SourceBar
                      label="Из ссылки"
                      count={data?.bookings.by_source.link ?? 0}
                      total={totalSource}
                      color="#4A7FB5"
                    />
                  )}
                </View>
              )}
            </View>
          </View>

          {/* ── Clients block ───────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Клиенты</Text>
            <View style={styles.card}>
              {/* Top metrics */}
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{data?.clients.visited ?? 0}</Text>
                  <Text style={styles.metricLabel}>Посетили</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{data?.clients.new ?? 0}</Text>
                  <Text style={styles.metricLabel}>Новые</Text>
                </View>
              </View>

              {/* Total clients */}
              <View style={styles.totalClientsRow}>
                <Text style={styles.totalClientsLabel}>Все клиенты</Text>
                <Text style={styles.totalClientsValue}>{data?.clients.total ?? 0}</Text>
              </View>

              {/* Segments */}
              {totalSegments > 0 && (
                <View style={styles.segmentsList}>
                  <SegmentRow
                    label="Постоянные"
                    segmentKey="regulars"
                    count={data?.clients.segments.regulars ?? 0}
                    total={totalSegments}
                    onPress={handleSegmentPress}
                  />
                  <SegmentRow
                    label="Спящие"
                    segmentKey="sleeping"
                    count={data?.clients.segments.sleeping ?? 0}
                    total={totalSegments}
                    onPress={handleSegmentPress}
                  />
                  <SegmentRow
                    label="Пропавшие"
                    segmentKey="lost"
                    count={data?.clients.segments.lost ?? 0}
                    total={totalSegments}
                    onPress={handleSegmentPress}
                  />
                  <SegmentRow
                    label="Не посещали"
                    segmentKey="not_visited"
                    count={data?.clients.segments.not_visited ?? 0}
                    total={totalSegments}
                    onPress={handleSegmentPress}
                  />
                </View>
              )}
            </View>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A18',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8A8A86',
    marginTop: 2,
  },
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F5F5F2',
    borderWidth: 1,
    borderColor: '#E8E8E4',
  },
  periodChipActive: {
    backgroundColor: '#1D6B4F',
    borderColor: '#1D6B4F',
  },
  periodChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5C5C58',
  },
  periodChipTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 15,
    color: '#C4462A',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1D6B4F',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A18',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 14,
    color: '#8A8A86',
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A18',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    padding: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A18',
  },
  metricLabel: {
    fontSize: 12,
    color: '#8A8A86',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E8E8E4',
    marginHorizontal: 8,
  },
  sourceBars: {
    marginTop: 4,
    gap: 8,
  },
  sourceBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sourceBarLabel: {
    fontSize: 13,
    color: '#5C5C58',
    width: 80,
  },
  sourceBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F5F5F2',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  sourceBarFill: {
    height: 6,
    borderRadius: 3,
  },
  sourceBarCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A18',
    width: 32,
    textAlign: 'right',
  },
  totalClientsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E4',
    marginTop: 4,
    marginBottom: 8,
  },
  totalClientsLabel: {
    fontSize: 14,
    color: '#5C5C58',
  },
  totalClientsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A18',
  },
  segmentsList: {
    gap: 0,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0EE',
    gap: 8,
  },
  segmentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  segmentLabel: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A18',
  },
  segmentCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A18',
    width: 36,
    textAlign: 'right',
  },
  segmentPct: {
    fontSize: 13,
    color: '#8A8A86',
    width: 36,
    textAlign: 'right',
  },
  gaugePercent: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A18',
    marginTop: 8,
  },
  gaugeLabel: {
    fontSize: 12,
    color: '#8A8A86',
  },
  bottomPadding: {
    height: 80,
  },
});
