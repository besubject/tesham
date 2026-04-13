export type TOutput = {
  color: string;
  label: string;
};

export const getStatusBadge = (bookingStatus: string): TOutput => {
  switch (bookingStatus) {
    case 'confirmed':
      return { color: 'teal', label: 'Подтверждена' };
    case 'completed':
      return { color: 'blue', label: 'Завершена' };
    case 'cancelled':
      return { color: 'red', label: 'Отменена' };
    case 'no_show':
      return { color: 'orange', label: 'Клиент не пришёл' };
    default:
      return { color: 'gray', label: bookingStatus };
  }
};
