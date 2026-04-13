import styles from '../../BookingsPage.module.scss';

export type TOutput = {
  className: string;
  label: string;
};

export const getStatusBadge = (bookingStatus: string): TOutput => {
  switch (bookingStatus) {
    case 'confirmed':
      return { className: styles.badgeConfirmed || '', label: 'Подтверждена' };
    case 'completed':
      return { className: styles.badgeCompleted || '', label: 'Завершена' };
    case 'cancelled':
      return { className: styles.badgeCancelled || '', label: 'Отменена' };
    case 'no_show':
      return { className: styles.badgeNoShow || '', label: 'Клиент не пришёл' };
    default:
      return { className: '', label: bookingStatus };
  }
};
