import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, type BusinessBookingItemDto } from '@mettig/shared';
import styles from './BookingsPage.module.scss';

function BookingsPage(): React.JSX.Element {
  const [status, setStatus] = useState<'all' | 'confirmed' | 'completed' | 'cancelled'>('all');

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['business-bookings', status],
    queryFn: async () => {
      const params = status === 'all' ? {} : { status };
      const { data } = await apiClient.get<BusinessBookingItemDto[]>(
        '/business/bookings',
        { params }
      );
      return data;
    },
  });

  const getStatusBadgeClass = (bookingStatus: string): string => {
    switch (bookingStatus) {
      case 'confirmed':
        return styles.badgeConfirmed || '';
      case 'completed':
        return styles.badgeCompleted || '';
      case 'cancelled':
        return styles.badgeCancelled || '';
      case 'no_show':
        return styles.badgeNoShow || '';
      default:
        return '';
    }
  };

  const getStatusLabel = (bookingStatus: string): string => {
    switch (bookingStatus) {
      case 'confirmed':
        return 'Подтверждена';
      case 'completed':
        return 'Завершена';
      case 'cancelled':
        return 'Отменена';
      case 'no_show':
        return 'Клиент не пришёл';
      default:
        return bookingStatus;
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className={styles.bookingsPage}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Записи</h1>
        <p className={styles.pageSubtitle}>Управление записями клиентов</p>
      </div>

      <div className={styles.filterTabs}>
        <button
          className={[styles.filterTab, status === 'all' ? styles.active : ''].filter(Boolean).join(' ')}
          onClick={() => setStatus('all')}
        >
          Все
        </button>
        <button
          className={[styles.filterTab, status === 'confirmed' ? styles.active : ''].filter(Boolean).join(' ')}
          onClick={() => setStatus('confirmed')}
        >
          Подтверждены
        </button>
        <button
          className={[styles.filterTab, status === 'completed' ? styles.active : ''].filter(Boolean).join(' ')}
          onClick={() => setStatus('completed')}
        >
          Завершены
        </button>
        <button
          className={[styles.filterTab, status === 'cancelled' ? styles.active : ''].filter(Boolean).join(' ')}
          onClick={() => setStatus('cancelled')}
        >
          Отменены
        </button>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : bookings.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Нет записей</p>
        </div>
      ) : (
        <div className={styles.bookingsGrid}>
          {bookings.map((booking) => (
            <div key={booking.id} className={styles.bookingCard}>
              <div className={styles.bookingHeader}>
                <div className={styles.bookingDateTime}>
                  <span className={styles.bookingDate}>{formatDate(booking.slot_date)}</span>
                  <span className={styles.bookingTime}>{booking.slot_start_time}</span>
                </div>
                <span className={[styles.statusBadge, getStatusBadgeClass(booking.status)].filter(Boolean).join(' ')}>
                  {getStatusLabel(booking.status)}
                </span>
              </div>

              <div className={styles.bookingDetails}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Услуга:</span>
                  <span className={styles.detailValue}>{booking.service_name}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Цена:</span>
                  <span className={styles.detailValue}>{booking.service_price.toLocaleString('ru-RU')} ₽</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Клиент:</span>
                  <span className={styles.detailValue}>{booking.client_name}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Телефон:</span>
                  <span className={styles.detailValue}>{booking.client_phone}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Мастер:</span>
                  <span className={styles.detailValue}>{booking.staff_name}</span>
                </div>
              </div>

              {booking.status === 'confirmed' && (
                <div className={styles.bookingActions}>
                  <button className={[styles.actionBtn, styles.actionComplete].join(' ')}>Завершить</button>
                  <button className={[styles.actionBtn, styles.actionCancel].join(' ')}>Отменить</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BookingsPage;
