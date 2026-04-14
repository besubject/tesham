export const bookingCardDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export const bookingCardPriceFormatter = new Intl.NumberFormat('ru-RU');
