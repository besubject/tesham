import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiClient } from '@mettig/shared';
import { trackEvent } from '../../utils/track-event';
import styles from './index.module.scss';

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientSegment = 'regulars' | 'sleeping' | 'lost' | 'not_visited' | 'new';

interface ClientSegmentCounts {
  regulars: number;
  sleeping: number;
  lost: number;
  not_visited: number;
  new: number;
  total: number;
}

interface ClientListItem {
  id: string;
  name: string | null;
  phone: string | null;
  segment: ClientSegment;
  total_visits: number;
  total_revenue: number;
  first_visit_at: string | null;
  last_visit_at: string | null;
}

interface ClientListResult {
  clients: ClientListItem[];
  next_cursor: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

interface SegmentMeta {
  key: ClientSegment;
  label: string;
  description: string;
  color: string;
  emoji: string;
}

const SEGMENTS: SegmentMeta[] = [
  { key: 'regulars', label: 'Постоянные', description: '≥2 визита за 90 дней', color: '#1D6B4F', emoji: '⭐' },
  { key: 'sleeping', label: 'Спящие', description: 'Не были 30–180 дней', color: '#B07415', emoji: '😴' },
  { key: 'lost', label: 'Пропавшие', description: 'Не были более 180 дней', color: '#C4462A', emoji: '👻' },
  { key: 'not_visited', label: 'Не посещали', description: 'Записи без визита', color: '#8A8A86', emoji: '🔇' },
  { key: 'new', label: 'Новые', description: 'Первый визит до 30 дней', color: '#2563EB', emoji: '✨' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(s: string | null): string {
  if (!s) return '—';
  const parts = s.split('T')[0]?.split('-') ?? [];
  if (parts.length !== 3) return s;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function getSegmentColor(seg: ClientSegment): string {
  return SEGMENTS.find((s) => s.key === seg)?.color ?? '#8A8A86';
}

function getSegmentLabel(seg: ClientSegment): string {
  return SEGMENTS.find((s) => s.key === seg)?.label ?? seg;
}

function getInitial(name: string | null): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

// ─── ClientsPage ─────────────────────────────────────────────────────────────

export function ClientsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSegment = searchParams.get('segment') as ClientSegment | null;
  const [activeSegment, setActiveSegment] = useState<ClientSegment | undefined>(
    initialSegment ?? undefined,
  );
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void trackEvent({ event_type: 'clients_screen_opened' });
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearch(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(e.target.value), 300);
  };

  const handleSegmentPress = useCallback(
    (key: ClientSegment) => {
      const next = activeSegment === key ? undefined : key;
      setActiveSegment(next);
      if (next) {
        setSearchParams({ segment: next });
        void trackEvent({ event_type: 'client_segment_filtered', payload: { segment: next } });
      } else {
        setSearchParams({});
      }
    },
    [activeSegment, setSearchParams],
  );

  const { data: segmentsData, isLoading: segmentsLoading } = useQuery({
    queryKey: ['client-segments'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ segments: ClientSegmentCounts }>(
        '/business/clients/segments',
      );
      return data.segments;
    },
    staleTime: 60_000,
  });

  const {
    data: clientsPages,
    isLoading: clientsLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['business-clients', activeSegment, debouncedSearch],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: '30' };
      if (activeSegment) params['segment'] = activeSegment;
      if (debouncedSearch.trim()) params['search'] = debouncedSearch.trim();
      if (typeof pageParam === 'string') params['cursor'] = pageParam;
      const { data } = await apiClient.get<ClientListResult>('/business/clients', { params });
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    staleTime: 30_000,
  });

  const clients = clientsPages?.pages.flatMap((p) => p.clients) ?? [];

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const total = segmentsData?.total ?? 0;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Клиенты{total > 0 ? ` (${total})` : ''}</h1>
      </div>

      {/* Segment cards grid */}
      {segmentsLoading ? (
        <div className={styles.segmentGrid}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.skeleton} style={{ height: 96 }} />
          ))}
        </div>
      ) : (
        <div className={styles.segmentGrid}>
          {SEGMENTS.map((meta) => (
            <button
              key={meta.key}
              className={[
                styles.segmentCard,
                activeSegment === meta.key ? styles.segmentCardActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={activeSegment === meta.key ? { borderColor: meta.color } : undefined}
              onClick={() => handleSegmentPress(meta.key)}
            >
              <span className={styles.segCardEmoji}>{meta.emoji}</span>
              <span className={styles.segCardCount} style={{ color: meta.color }}>
                {segmentsData?.[meta.key] ?? 0}
              </span>
              <span className={styles.segCardLabel}>{meta.label}</span>
              <span className={styles.segCardDesc}>{meta.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search + filter row */}
      <div className={styles.filterRow}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Поиск по имени или телефону"
          value={search}
          onChange={handleSearchChange}
        />
        <div className={styles.chips}>
          <button
            className={[styles.chip, activeSegment === undefined ? styles.chipActive : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => {
              setActiveSegment(undefined);
              setSearchParams({});
            }}
          >
            Все
          </button>
          {SEGMENTS.map((meta) => (
            <button
              key={meta.key}
              className={[styles.chip, activeSegment === meta.key ? styles.chipActive : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleSegmentPress(meta.key)}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Имя</th>
              <th>Телефон</th>
              <th>Последний визит</th>
              <th>Визиты</th>
              <th>Сегмент</th>
            </tr>
          </thead>
          <tbody>
            {clientsLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {[1, 2, 3, 4, 5].map((j) => (
                    <td key={j}>
                      <div className={styles.skeletonCell} />
                    </td>
                  ))}
                </tr>
              ))
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  <div className={styles.emptyState}>
                    <span>👤</span>
                    <p>
                      {activeSegment || debouncedSearch
                        ? 'Нет клиентов по выбранному фильтру'
                        : 'Клиентов пока нет'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              clients.map((client) => {
                const color = getSegmentColor(client.segment);
                const initial = getInitial(client.name);
                return (
                  <tr
                    key={client.id}
                    className={styles.tableRow}
                    onClick={() => {
                      void trackEvent({
                        event_type: 'client_card_opened',
                        payload: { client_id: client.id },
                      });
                      void navigate(`/clients/${client.id}`);
                    }}
                  >
                    <td>
                      <div className={styles.nameCell}>
                        <div
                          className={styles.avatar}
                          style={{ background: color }}
                        >
                          {initial}
                        </div>
                        <span>{client.name ?? 'Аноним'}</span>
                      </div>
                    </td>
                    <td className={styles.dimmed}>{client.phone ?? '—'}</td>
                    <td className={styles.dimmed}>{formatDate(client.last_visit_at)}</td>
                    <td>{client.total_visits}</td>
                    <td>
                      <span
                        className={styles.segBadge}
                        style={{ color, background: color + '18', borderColor: color + '40' }}
                      >
                        {getSegmentLabel(client.segment)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Infinite scroll loader */}
      <div ref={loaderRef} className={styles.loaderSentinel}>
        {isFetchingNextPage && <span className={styles.loadingDots}>Загрузка...</span>}
      </div>
    </div>
  );
}
