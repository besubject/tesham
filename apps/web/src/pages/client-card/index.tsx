import React, { useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiClient } from '@mettig/shared';
import styles from './index.module.scss';

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientSegment = 'regulars' | 'sleeping' | 'lost' | 'not_visited' | 'new';

interface BookingHistoryItem {
  id: string;
  slot_date: string;
  slot_time: string;
  service_name: string;
  service_price: number;
  staff_name: string;
  status: string;
  source: string;
  created_at: string;
}

interface ClientCard {
  id: string;
  name: string | null;
  phone: string | null;
  segment: ClientSegment;
  total_visits: number;
  total_revenue: number;
  first_visit_at: string | null;
  last_visit_at: string | null;
  bookings: BookingHistoryItem[];
  next_cursor: string | null;
}

interface ClientCardResponse {
  client: ClientCard;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGMENT_LABELS: Record<ClientSegment, string> = {
  regulars: 'Постоянный',
  sleeping: 'Спящий',
  lost: 'Пропавший',
  not_visited: 'Не посещал',
  new: 'Новый',
};

const SEGMENT_COLORS: Record<ClientSegment, string> = {
  regulars: '#1D6B4F',
  sleeping: '#B07415',
  lost: '#C4462A',
  not_visited: '#8A8A86',
  new: '#2563EB',
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Подтверждена',
  completed: 'Выполнена',
  cancelled: 'Отменена',
  no_show: 'Не пришёл',
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#1D6B4F',
  completed: '#2563EB',
  cancelled: '#8A8A86',
  no_show: '#D97706',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(s: string | null): string {
  if (!s) return '—';
  const dateStr = s.split('T')[0] ?? s;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return s;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

function formatPrice(p: number): string {
  return `${p.toLocaleString('ru-RU')} ₽`;
}

function getInitial(name: string | null): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

// ─── ClientCardPage ───────────────────────────────────────────────────────────

export function ClientCardPage(): React.JSX.Element {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  const { data: cardData, isLoading, error } = useQuery({
    queryKey: ['client-card', clientId],
    queryFn: async () => {
      const { data } = await apiClient.get<ClientCardResponse>(
        `/business/clients/${clientId}`,
      );
      return data.client;
    },
    staleTime: 60_000,
    enabled: !!clientId,
  });

  const {
    data: morePages,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['client-card-bookings', clientId],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = {};
      if (typeof pageParam === 'string') params['booking_cursor'] = pageParam;
      const { data } = await apiClient.get<ClientCardResponse>(
        `/business/clients/${clientId}`,
        { params },
      );
      return data.client;
    },
    initialPageParam: cardData?.next_cursor as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!cardData?.next_cursor,
    staleTime: 60_000,
  });

  const extraBookings = morePages?.pages.flatMap((p) => p.bookings) ?? [];
  const allBookings: BookingHistoryItem[] = [...(cardData?.bookings ?? []), ...extraBookings];

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const client = cardData;
  const displayName = client?.name ?? 'Аноним';
  const segmentColor =
    client ? (SEGMENT_COLORS[client.segment] ?? '#8A8A86') : '#8A8A86';
  const segmentLabel = client ? SEGMENT_LABELS[client.segment] : '';

  // Redirect to /clients if no clientId
  useEffect(() => {
    if (!clientId) void navigate('/clients');
  }, [clientId, navigate]);

  return (
    <div className={styles.page}>
      {/* Back nav */}
      <button className={styles.backBtn} onClick={() => void navigate('/clients')}>
        ‹ Клиенты
      </button>

      {isLoading ? (
        <div className={styles.skeletonWrap}>
          {[120, 100, 80, 300].map((h, i) => (
            <div key={i} className={styles.skeleton} style={{ height: h }} />
          ))}
        </div>
      ) : error != null ? (
        <div className={styles.centered}>
          <p className={styles.errorText}>Не удалось загрузить данные клиента</p>
        </div>
      ) : client != null ? (
        <div className={styles.layout}>
          {/* Left column: metrics */}
          <div className={styles.leftCol}>
            {/* Profile */}
            <div className={styles.profileCard}>
              <div className={styles.bigAvatar} style={{ background: segmentColor }}>
                {getInitial(client.name)}
              </div>
              <h2 className={styles.profileName}>{displayName}</h2>
              {client.phone && (
                <p className={styles.profilePhone}>{client.phone}</p>
              )}
              <span
                className={styles.segBadge}
                style={{
                  color: segmentColor,
                  background: segmentColor + '18',
                  borderColor: segmentColor + '40',
                }}
              >
                {segmentLabel}
              </span>
            </div>

            {/* Metrics grid */}
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>{client.total_visits}</span>
                <span className={styles.metricLabel}>Визитов</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>
                  {client.total_revenue > 0 ? formatPrice(client.total_revenue) : '—'}
                </span>
                <span className={styles.metricLabel}>Потрачено</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>{formatDate(client.first_visit_at)}</span>
                <span className={styles.metricLabel}>Первый визит</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>{formatDate(client.last_visit_at)}</span>
                <span className={styles.metricLabel}>Последний визит</span>
              </div>
            </div>
          </div>

          {/* Right column: history */}
          <div className={styles.rightCol}>
            <h3 className={styles.historyTitle}>История записей</h3>
            {allBookings.length === 0 ? (
              <div className={styles.emptyHistory}>
                <span>📋</span>
                <p>Нет записей</p>
              </div>
            ) : (
              <div className={styles.bookingList}>
                {allBookings.map((booking) => {
                  const statusColor = STATUS_COLORS[booking.status] ?? '#8A8A86';
                  const statusLabel = STATUS_LABELS[booking.status] ?? booking.status;
                  return (
                    <div key={booking.id} className={styles.bookingRow}>
                      <div className={styles.bookingMain}>
                        <span className={styles.bookingService}>{booking.service_name}</span>
                        <span className={styles.bookingMeta}>
                          {formatDate(booking.slot_date)} в {formatTime(booking.slot_time)} ·{' '}
                          {booking.staff_name}
                        </span>
                      </div>
                      <div className={styles.bookingRight}>
                        <span className={styles.bookingPrice}>
                          {formatPrice(booking.service_price)}
                        </span>
                        <span className={styles.bookingStatus} style={{ color: statusColor }}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {hasNextPage && (
                  <button
                    className={styles.loadMoreBtn}
                    onClick={handleLoadMore}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? 'Загрузка...' : 'Загрузить ещё'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
