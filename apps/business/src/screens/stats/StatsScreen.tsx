import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient, tokenStorage } from '@mettig/shared';
import type { BusinessStatsDto, StaffStatItemDto } from '@mettig/shared';
import type { StatsStackScreenProps } from '../../navigation/types';

type Props = StatsStackScreenProps<'StatsMain'>;

type Period = 'day' | 'week' | 'month';

const PERIOD_LABELS: Record<Period, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
};

const PERIODS: Period[] = ['day', 'week', 'month'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeJwtRole(token: string): 'admin' | 'employee' | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as { role?: string };
    if (payload.role === 'admin' || payload.role === 'employee') {
      return payload.role;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
}

function MetricCard({ label, value }: MetricCardProps): React.JSX.Element {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

// ─── StaffRow ─────────────────────────────────────────────────────────────────

interface StaffRowProps {
  item: StaffStatItemDto;
  isLast: boolean;
}

function StaffRow({ item, isLast }: StaffRowProps): React.JSX.Element {
  return (
    <View style={[styles.staffRow, !isLast && styles.staffRowBorder]}>
      <Text style={styles.staffName} numberOfLines={1}>
        {item.staff_name}
      </Text>
      <Text style={styles.staffBookings}>{item.bookings_count}</Text>
      <Text style={styles.staffShowRate}>{item.show_rate_pct}%</Text>
    </View>
  );
}

// ─── StatsScreen ──────────────────────────────────────────────────────────────

export function StatsScreen(_props: Props): React.JSX.Element {
  const [period, setPeriod] = useState<Period>('week');
  const [stats, setStats] = useState<BusinessStatsDto | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve role once on mount
  useEffect(() => {
    void (async () => {
      const token = await tokenStorage.getAccessToken();
      if (token) {
        const role = decodeJwtRole(token);
        setIsAdmin(role === 'admin');
      }
    })();
  }, []);

  const fetchStats = useCallback(async (selectedPeriod: Period, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const { data } = await apiClient.get<{ stats: BusinessStatsDto }>('/business/stats', {
        params: { period: selectedPeriod },
      });
      setStats(data.stats);
    } catch {
      setError('Не удалось загрузить статистику');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats(period);
  }, [period, fetchStats]);

  const handleRefresh = useCallback(() => {
    void fetchStats(period, true);
  }, [period, fetchStats]);

  const ratingValue = stats?.avg_rating != null ? `★ ${stats.avg_rating.toFixed(1)}` : '—';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Статистика</Text>
      </View>

      {/* Period switcher */}
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodChip, period === p && styles.periodChipActive]}
            onPress={() => setPeriod(p)}
            accessibilityLabel={`Период ${PERIOD_LABELS[p]}`}
          >
            <Text style={[styles.periodChipText, period === p && styles.periodChipTextActive]}>
              {PERIOD_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main content */}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1D6B4F" />
        </View>
      ) : error && !stats ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => void fetchStats(period)}
            accessibilityLabel="Повторить загрузку"
          >
            <Text style={styles.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#1D6B4F"
              colors={['#1D6B4F']}
            />
          }
        >
          {/* Metric cards */}
          <View style={styles.metricsRow}>
            <MetricCard label="Записей" value={String(stats?.bookings_count ?? 0)} />
            <MetricCard label="Рейтинг" value={ratingValue} />
            <MetricCard label="Show rate" value={`${stats?.show_rate_pct ?? 0}%`} />
          </View>

          {/* Source section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Откуда клиенты</Text>
            <View style={styles.sourceCard}>
              <View style={styles.sourceRow}>
                <View style={[styles.sourceDot, styles.sourceDotApp]} />
                <Text style={styles.sourceLabel}>Из Mettig</Text>
                <Text style={styles.sourceValue}>{stats?.by_source.app ?? 0}</Text>
              </View>
              <View style={styles.sourceDivider} />
              <View style={styles.sourceRow}>
                <View style={[styles.sourceDot, styles.sourceDotWalkIn]} />
                <Text style={styles.sourceLabel}>Walk-in</Text>
                <Text style={styles.sourceValue}>{stats?.by_source.walk_in ?? 0}</Text>
              </View>
            </View>
          </View>

          {/* Staff breakdown — admin only */}
          {isAdmin && stats != null && stats.by_staff.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>По мастерам</Text>
              <View style={styles.staffCard}>
                {/* Table header */}
                <View style={[styles.staffRow, styles.staffRowHeader, styles.staffRowBorder]}>
                  <Text style={[styles.staffName, styles.staffHeaderText]}>Мастер</Text>
                  <Text style={[styles.staffBookings, styles.staffHeaderText]}>Записей</Text>
                  <Text style={[styles.staffShowRate, styles.staffHeaderText]}>Show rate</Text>
                </View>
                {stats.by_staff.map((item, index) => (
                  <StaffRow
                    key={item.staff_id}
                    item={item}
                    isLast={index === stats.by_staff.length - 1}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Bottom padding for tab bar */}
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
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A18',
  },
  // Period switcher
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
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
  // States
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
  // Scroll
  scrollContent: {
    paddingHorizontal: 16,
  },
  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A18',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: '#8A8A86',
    textAlign: 'center',
  },
  // Section
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A18',
    marginBottom: 10,
  },
  // Source card
  sourceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    paddingHorizontal: 16,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  sourceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sourceDotApp: {
    backgroundColor: '#1D6B4F',
  },
  sourceDotWalkIn: {
    backgroundColor: '#B07415',
  },
  sourceLabel: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A18',
  },
  sourceValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A18',
  },
  sourceDivider: {
    height: 1,
    backgroundColor: '#E8E8E4',
    marginHorizontal: -16,
  },
  // Staff table
  staffCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    overflow: 'hidden',
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  staffRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E4',
  },
  staffRowHeader: {
    backgroundColor: '#F5F5F2',
  },
  staffHeaderText: {
    fontSize: 12,
    color: '#8A8A86',
    fontWeight: '500',
  },
  staffName: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A18',
    fontWeight: '500',
  },
  staffBookings: {
    width: 60,
    fontSize: 14,
    color: '#1A1A18',
    textAlign: 'center',
  },
  staffShowRate: {
    width: 70,
    fontSize: 14,
    color: '#1A1A18',
    textAlign: 'right',
  },
  // Bottom padding
  bottomPadding: {
    height: 80,
  },
});
