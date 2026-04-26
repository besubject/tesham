import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@mettig/shared';
import { trackEvent } from '../../utils/track-event';
import styles from './index.module.scss';

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalyticsPeriod = 'day' | 'week' | 'month';

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

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'day', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
];

const SEGMENT_COLORS: Record<string, string> = {
  regulars: '#1D6B4F',
  sleeping: '#B07415',
  lost: '#C4462A',
  not_visited: '#8A8A86',
};

const SEGMENT_LABELS: Record<string, string> = {
  regulars: 'Постоянные',
  sleeping: 'Спящие',
  lost: 'Пропавшие',
  not_visited: 'Не посещали',
};

const RU_MONTHS = [
  'янв.', 'фев.', 'мар.', 'апр.', 'май', 'июн.',
  'июл.', 'авг.', 'сен.', 'окт.', 'ноя.', 'дек.',
];

const FULL_MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

function formatSubtitle(period: AnalyticsPeriod, dateFrom: string, dateTo: string): string {
  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);
  if (period === 'day') return `Сегодня, ${from.getDate()} ${RU_MONTHS[from.getMonth()]}`;
  if (period === 'week') {
    return `Неделя ${from.getDate()}–${to.getDate()} ${RU_MONTHS[to.getMonth()]}`;
  }
  return `${FULL_MONTHS[from.getMonth()]} ${from.getFullYear()}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SourceBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}): React.JSX.Element {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={styles.sourceBar}>
      <span className={styles.sourceDot} style={{ background: color }} />
      <span className={styles.sourceLabel}>{label}</span>
      <div className={styles.sourceTrack}>
        <div className={styles.sourceFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.sourceCount}>{count}</span>
    </div>
  );
}

// ─── AnalyticsPage ────────────────────────────────────────────────────────────

export function AnalyticsPage(): React.JSX.Element {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    void trackEvent({ event_type: 'analytics_dashboard_opened', payload: { period } });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, error, refetch } = useQuery({
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

  const handlePeriodChange = (p: AnalyticsPeriod): void => {
    if (p === period) return;
    setPeriod(p);
    void trackEvent({ event_type: 'analytics_period_changed', payload: { period: p } });
  };

  const totalSource = data
    ? data.bookings.by_source.app + data.bookings.by_source.walk_in + data.bookings.by_source.link
    : 0;

  const totalSegments = data
    ? data.clients.segments.regulars +
      data.clients.segments.sleeping +
      data.clients.segments.lost +
      data.clients.segments.not_visited
    : 0;

  const subtitle = data ? formatSubtitle(period, data.date_from, data.date_to) : '';

  const isEmpty =
    !isLoading && data != null && data.bookings.count === 0 && data.clients.total === 0;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Аналитика</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>

      {/* Period switcher */}
      <div className={styles.periodRow}>
        {PERIODS.map((p) => (
          <button
            key={p.value}
            className={[styles.periodChip, period === p.value ? styles.active : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => handlePeriodChange(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* States */}
      {isLoading ? (
        <div className={styles.grid2}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeleton} style={{ height: 160 }} />
          ))}
        </div>
      ) : error != null && data == null ? (
        <div className={styles.centered}>
          <p className={styles.errorText}>Не удалось загрузить аналитику</p>
          <button className={styles.retryBtn} onClick={() => void refetch()}>
            Повторить
          </button>
        </div>
      ) : isEmpty ? (
        <div className={styles.centered}>
          <span className={styles.emptyIcon}>📊</span>
          <p className={styles.emptyTitle}>Нет данных пока</p>
          <p className={styles.emptyHint}>Создайте первую запись, чтобы увидеть аналитику</p>
        </div>
      ) : (
        <div className={styles.grid2}>
          {/* Occupancy */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Загруженность</h2>
            <div className={styles.occupancyBlock}>
              <div className={styles.occupancyGauge}>
                <svg viewBox="0 0 120 60" className={styles.gaugeSvg}>
                  <path
                    d="M10,60 A50,50 0 0,1 110,60"
                    fill="none"
                    stroke="#E8E8E4"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10,60 A50,50 0 0,1 110,60"
                    fill="none"
                    stroke="#1D6B4F"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${((data?.occupancy.percent ?? 0) / 100) * 157} 157`}
                  />
                </svg>
                <div className={styles.gaugeLabel}>
                  <span className={styles.gaugePct}>{data?.occupancy.percent ?? 0}%</span>
                  <span className={styles.gaugeHint}>занято</span>
                </div>
              </div>
              <div className={styles.occupancyMeta}>
                <p>
                  {data?.occupancy.busy_minutes ?? 0} мин из {data?.occupancy.total_minutes ?? 0} мин
                </p>
              </div>
            </div>
          </div>

          {/* Bookings */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Записи</h2>
            <div className={styles.metricsRow}>
              <div className={styles.metric}>
                <span className={styles.metricValue}>{data?.bookings.count ?? 0}</span>
                <span className={styles.metricLabel}>записей</span>
              </div>
              <div className={styles.metricDivider} />
              <div className={styles.metric}>
                <span className={styles.metricValue}>
                  {data != null ? `${data.bookings.sum_planned.toLocaleString('ru')} ₽` : '—'}
                </span>
                <span className={styles.metricLabel}>план</span>
              </div>
            </div>
            {totalSource > 0 && (
              <div className={styles.sourceBars}>
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
              </div>
            )}
          </div>

          {/* Clients */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Клиенты</h2>
            <div className={styles.metricsRow}>
              <div className={styles.metric}>
                <span className={styles.metricValue}>{data?.clients.visited ?? 0}</span>
                <span className={styles.metricLabel}>Посетили</span>
              </div>
              <div className={styles.metricDivider} />
              <div className={styles.metric}>
                <span className={styles.metricValue}>{data?.clients.new ?? 0}</span>
                <span className={styles.metricLabel}>Новые</span>
              </div>
            </div>
            <div className={styles.totalClientsRow}>
              <span className={styles.totalClientsLabel}>Все клиенты</span>
              <span className={styles.totalClientsValue}>{data?.clients.total ?? 0}</span>
            </div>
            {totalSegments > 0 && (
              <div className={styles.segmentsList}>
                {(
                  [
                    ['regulars', data?.clients.segments.regulars ?? 0],
                    ['sleeping', data?.clients.segments.sleeping ?? 0],
                    ['lost', data?.clients.segments.lost ?? 0],
                    ['not_visited', data?.clients.segments.not_visited ?? 0],
                  ] as [string, number][]
                ).map(([key, count]) => {
                  const pct = totalSegments > 0 ? Math.round((count / totalSegments) * 100) : 0;
                  const color = SEGMENT_COLORS[key] ?? '#8A8A86';
                  return (
                    <button
                      key={key}
                      className={styles.segmentRow}
                      onClick={() => void navigate(`/clients?segment=${key}`)}
                    >
                      <span className={styles.segDot} style={{ background: color }} />
                      <span className={styles.segLabel}>{SEGMENT_LABELS[key]}</span>
                      <span className={styles.segCount}>{count}</span>
                      <span className={styles.segPct}>{pct}%</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
