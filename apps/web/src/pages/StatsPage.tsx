import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, type BusinessStatsDto } from '@mettig/shared';
import styles from './StatsPage.module.scss';

type Period = 'day' | 'week' | 'month';

function StatsPage(): React.JSX.Element {
  const [period, setPeriod] = useState<Period>('month');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['business-stats', period],
    queryFn: async () => {
      const { data } = await apiClient.get<BusinessStatsDto>(
        '/business/stats',
        { params: { period } }
      );
      return data;
    },
  });

  const getSourcePercentage = (source: number, total: number): number => {
    if (total === 0) return 0;
    return Math.round((source / total) * 100);
  };

  return (
    <div className={styles.statsPage}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Статистика</h1>
        <p className={styles.pageSubtitle}>Анализ деятельности вашего бизнеса</p>
      </div>

      <div className={styles.periodSelector}>
        <button
          className={[styles.periodBtn, period === 'day' ? styles.active : ''].filter(Boolean).join(' ')}
          onClick={() => setPeriod('day')}
        >
          День
        </button>
        <button
          className={[styles.periodBtn, period === 'week' ? styles.active : ''].filter(Boolean).join(' ')}
          onClick={() => setPeriod('week')}
        >
          Неделя
        </button>
        <button
          className={[styles.periodBtn, period === 'month' ? styles.active : ''].filter(Boolean).join(' ')}
          onClick={() => setPeriod('month')}
        >
          Месяц
        </button>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : stats ? (
        <>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.bookings_count}</div>
              <div className={styles.statLabel}>Записи</div>
            </div>

            {stats.avg_rating !== null && (
              <div className={styles.statCard}>
                <div className={styles.statValue}>
                  {stats.avg_rating.toFixed(1)}
                  <span className={styles.star}>⭐</span>
                </div>
                <div className={styles.statLabel}>Средняя оценка</div>
              </div>
            )}

            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.show_rate_pct}%</div>
              <div className={styles.statLabel}>Явка клиентов</div>
            </div>
          </div>

          <div className={styles.sourcesSection}>
            <h2 className={styles.sectionTitle}>Источники записей</h2>
            <div className={styles.sourcesGrid}>
              <div className={styles.sourceCard}>
                <div className={styles.sourceLabel}>Мобильное приложение</div>
                <div className={styles.sourceValue}>
                  {stats.by_source.app}
                  <span className={styles.sourcePercentage}>
                    {getSourcePercentage(stats.by_source.app, stats.bookings_count)}%
                  </span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${getSourcePercentage(stats.by_source.app, stats.bookings_count)}%`,
                    }}
                  />
                </div>
              </div>

              <div className={styles.sourceCard}>
                <div className={styles.sourceLabel}>Приём без записи</div>
                <div className={styles.sourceValue}>
                  {stats.by_source.walk_in}
                  <span className={styles.sourcePercentage}>
                    {getSourcePercentage(stats.by_source.walk_in, stats.bookings_count)}%
                  </span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${getSourcePercentage(stats.by_source.walk_in, stats.bookings_count)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {stats.by_staff.length > 0 && (
            <div className={styles.staffSection}>
              <h2 className={styles.sectionTitle}>Статистика по мастерам</h2>
              <div className={styles.staffTableWrapper}>
                <table className={styles.staffTable}>
                  <thead>
                    <tr>
                      <th>Мастер</th>
                      <th>Записи</th>
                      <th>Явка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.by_staff.map((staff) => (
                      <tr key={staff.staff_id}>
                        <td>{staff.staff_name}</td>
                        <td>{staff.bookings_count}</td>
                        <td>{staff.show_rate_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState}>Нет данных</div>
      )}
    </div>
  );
}

export default StatsPage;
