import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, type BusinessBookingItemDto } from '@mettig/shared';
import './BookingsPage.css';

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
        return 'badge-confirmed';
      case 'completed':
        return 'badge-completed';
      case 'cancelled':
        return 'badge-cancelled';
      case 'no_show':
        return 'badge-no-show';
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
    <div className="bookings-page">
      <div className="page-header">
        <h1 className="page-title">Записи</h1>
        <p className="page-subtitle">Управление записями клиентов</p>
      </div>

      <div className="filter-tabs">
        <button
          className={`filter-tab ${status === 'all' ? 'active' : ''}`}
          onClick={() => setStatus('all')}
        >
          Все
        </button>
        <button
          className={`filter-tab ${status === 'confirmed' ? 'active' : ''}`}
          onClick={() => setStatus('confirmed')}
        >
          Подтверждены
        </button>
        <button
          className={`filter-tab ${status === 'completed' ? 'active' : ''}`}
          onClick={() => setStatus('completed')}
        >
          Завершены
        </button>
        <button
          className={`filter-tab ${status === 'cancelled' ? 'active' : ''}`}
          onClick={() => setStatus('cancelled')}
        >
          Отменены
        </button>
      </div>

      {isLoading ? (
        <div className="loading">Загрузка...</div>
      ) : bookings.length === 0 ? (
        <div className="empty-state">
          <p>Нет записей</p>
        </div>
      ) : (
        <div className="bookings-grid">
          {bookings.map((booking) => (
            <div key={booking.id} className="booking-card">
              <div className="booking-header">
                <div className="booking-date-time">
                  <span className="booking-date">{formatDate(booking.slot_date)}</span>
                  <span className="booking-time">{booking.slot_start_time}</span>
                </div>
                <span className={`status-badge ${getStatusBadgeClass(booking.status)}`}>
                  {getStatusLabel(booking.status)}
                </span>
              </div>

              <div className="booking-details">
                <div className="detail-row">
                  <span className="detail-label">Услуга:</span>
                  <span className="detail-value">{booking.service_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Цена:</span>
                  <span className="detail-value">{booking.service_price.toLocaleString('ru-RU')} ₽</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Клиент:</span>
                  <span className="detail-value">{booking.client_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Телефон:</span>
                  <span className="detail-value">{booking.client_phone}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Мастер:</span>
                  <span className="detail-value">{booking.staff_name}</span>
                </div>
              </div>

              {booking.status === 'confirmed' && (
                <div className="booking-actions">
                  <button className="action-btn action-complete">Завершить</button>
                  <button className="action-btn action-cancel">Отменить</button>
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
