import React from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@mettig/shared';
import type { StatsStackScreenProps } from '../../navigation/types';

// ─── API types ────────────────────────────────────────────────────────────────

interface ClientSegmentCounts {
  regulars: number;
  sleeping: number;
  lost: number;
  not_visited: number;
  new: number;
  total: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return rate = clients who visited more than once / all clients who visited at least once
 * "returned" = regulars + sleeping + lost (visited more than once implies multiple visits)
 * We exclude "new" (only 1 visit so far, might return later) and "not_visited" (booked but never showed)
 */
function computeReturnRate(segments: ClientSegmentCounts): {
  rate: number;
  returned: number;
  activeClients: number;
} {
  const returned = segments.regulars + segments.sleeping + segments.lost;
  const activeClients = returned + segments.new;
  const rate = activeClients > 0 ? Math.round((returned / activeClients) * 100) : 0;
  return { rate, returned, activeClients };
}

// ─── Arc gauge ────────────────────────────────────────────────────────────────

function RateGauge({ percent }: { percent: number }): React.JSX.Element {
  const clampedPct = Math.max(0, Math.min(100, percent));
  const size = 160;
  const borderW = 16;
  const filledColor = '#1D6B4F';
  const emptyColor = '#E8E8E4';
  const pctRotation = (clampedPct / 100) * 180;

  return (
    <View style={{ alignItems: 'center', marginVertical: 12 }}>
      <View style={{ width: size, height: size / 2, overflow: 'hidden' }}>
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
        <View
          style={{
            width: size / 2,
            height: size,
            overflow: 'hidden',
            position: 'absolute',
            left: size / 2,
          }}
        >
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
        {clampedPct > 50 && (
          <View
            style={{
              width: size / 2,
              height: size,
              overflow: 'hidden',
              position: 'absolute',
            }}
          >
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
      <View style={{ marginTop: -4, alignItems: 'center' }}>
        <Text style={styles.gaugePercent}>{clampedPct}%</Text>
        <Text style={styles.gaugeLabel}>возвращаются</Text>
      </View>
    </View>
  );
}

// ─── ReturnRateScreen ─────────────────────────────────────────────────────────

type Props = StatsStackScreenProps<'ReturnRateScreen'>;

export function ReturnRateScreen({ navigation }: Props): React.JSX.Element {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['client-segments-return-rate'],
    queryFn: async () => {
      const { data: resp } = await apiClient.get<{ segments: ClientSegmentCounts }>(
        '/business/clients/segments',
      );
      return resp.segments;
    },
    staleTime: 60_000,
  });

  const { rate, returned, activeClients } = data
    ? computeReturnRate(data)
    : { rate: 0, returned: 0, activeClients: 0 };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Назад"
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Возвращаемость</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor="#1D6B4F"
            colors={['#1D6B4F']}
          />
        }
      >
        {isLoading ? (
          <View style={styles.centered}>
            <View style={{ height: 80, width: 160, borderRadius: 12, backgroundColor: '#E8E8E4' }} />
          </View>
        ) : error != null ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>Не удалось загрузить данные</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void refetch()}
              accessibilityLabel="Повторить"
            >
              <Text style={styles.retryText}>Повторить</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Main gauge card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Процент возвращаемости</Text>
              <RateGauge percent={rate} />
              <Text style={styles.cardDescription}>
                {returned} из {activeClients} клиентов вернулись на второй визит
              </Text>
            </View>

            {/* Breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Разбивка</Text>

              <View style={styles.breakdownRow}>
                <View style={[styles.breakdownDot, { backgroundColor: '#1D6B4F' }]} />
                <Text style={styles.breakdownLabel}>Постоянные</Text>
                <Text style={styles.breakdownValue}>{data?.regulars ?? 0}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <View style={[styles.breakdownDot, { backgroundColor: '#B07415' }]} />
                <Text style={styles.breakdownLabel}>Спящие</Text>
                <Text style={styles.breakdownValue}>{data?.sleeping ?? 0}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <View style={[styles.breakdownDot, { backgroundColor: '#C4462A' }]} />
                <Text style={styles.breakdownLabel}>Пропавшие</Text>
                <Text style={styles.breakdownValue}>{data?.lost ?? 0}</Text>
              </View>
              <View style={[styles.breakdownRow, styles.breakdownRowDivider]}>
                <View style={[styles.breakdownDot, { backgroundColor: '#2563EB' }]} />
                <Text style={styles.breakdownLabel}>Новые (ещё не вернулись)</Text>
                <Text style={styles.breakdownValue}>{data?.new ?? 0}</Text>
              </View>
            </View>

            {/* Hint */}
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>
                Возвращаемость рассчитывается как доля клиентов с повторными визитами среди всех,
                кто посещал заведение. Клиенты без завершённых записей не учитываются.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: '#1D6B4F',
    lineHeight: 32,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A18',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 80,
    gap: 16,
  },
  centered: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#C4462A',
    textAlign: 'center',
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    padding: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A18',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: '#8A8A86',
    textAlign: 'center',
    marginTop: 4,
  },
  gaugePercent: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1A1A18',
    marginTop: 8,
  },
  gaugeLabel: {
    fontSize: 13,
    color: '#8A8A86',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0EE',
    gap: 10,
  },
  breakdownRowDivider: {
    borderTopColor: '#E8E8E4',
    marginTop: 4,
  },
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A18',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A18',
  },
  hintBox: {
    backgroundColor: '#F5F5F2',
    borderRadius: 10,
    padding: 14,
  },
  hintText: {
    fontSize: 12,
    color: '#8A8A86',
    lineHeight: 18,
  },
});
