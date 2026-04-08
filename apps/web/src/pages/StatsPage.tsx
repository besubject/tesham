import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, type BusinessStatsDto } from '@mettig/shared';
import './StatsPage.css';

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
    <div className="stats-page">
      <div className="page-header">
        <h1 className="page-title">Статистика</h1>
        <p className="page-subtitle">Анализ деятельности вашего бизнеса</p>
      </div>

      <div className="period-selector">
        <button
          className={`period-btn ${period === 'day' ? 'active' : ''}`}
          onClick={() => setPeriod('day')}
        >
          День
        </button>
        <button
          className={`period-btn ${period === 'week' ? 'active' : ''}`}
          onClick={() => setPeriod('week')}
        >
          Неделя
        </button>
        <button
          className={`period-btn ${period === 'month' ? 'active' : ''}`}
          onClick={() => setPeriod('month')}
        >
          Месяц
        </button>
      </div>

      {isLoading ? (
        <div className="loading">Загрузка...</div>
      ) : stats ? (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.bookings_count}</div>
              <div className="stat-label">Записи</div>
            </div>

            {stats.avg_rating !== null && (
              <div className="stat-card">
                <div className="stat-value">
                  {stats.avg_rating.toFixed(1)}
                  <span className="star">⭐</span>
                </div>
                <div className="stat-label">Средняя оценка</div>
              </div>
            )}

            <div className="stat-card">
              <div className="stat-value">{stats.show_rate_pct}%</div>
              <div className="stat-label">Явка клиентов</div>
            </div>
          </div>

          <div className="sources-section">
            <h2 className="section-title">Источники записей</h2>
            <div className="sources-grid">
              <div className="source-card">
                <div className="source-label">Мобильное приложение</div>
                <div className="source-value">
                  {stats.by_source.app}
                  <span className="source-percentage">
                    {getSourcePercentage(stats.by_source.app, stats.bookings_count)}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${getSourcePercentage(stats.by_source.app, stats.bookings_count)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="source-card">
                <div className="source-label">Приём без записи</div>
                <div className="source-value">
                  {stats.by_source.walk_in}
                  <span className="source-percentage">
                    {getSourcePercentage(stats.by_source.walk_in, stats.bookings_count)}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${getSourcePercentage(stats.by_source.walk_in, stats.bookings_count)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {stats.by_staff.length > 0 && (
            <div className="staff-section">
              <h2 className="section-title">Статистика по мастерам</h2>
              <div className="staff-table-wrapper">
                <table className="staff-table">
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
        <div className="empty-state">Нет данных</div>
      )}
    </div>
  );
}

export default StatsPage;
