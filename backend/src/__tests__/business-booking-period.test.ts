import { getBusinessBookingsPeriodBounds } from '../services/business-booking.service';

describe('getBusinessBookingsPeriodBounds', () => {
  it('returns the same day for today', () => {
    expect(getBusinessBookingsPeriodBounds('today', new Date('2026-04-13T10:00:00Z'))).toEqual({
      start: '2026-04-13',
      end: '2026-04-13',
    });
  });

  it('returns calendar week bounds from monday to sunday', () => {
    expect(getBusinessBookingsPeriodBounds('week', new Date('2026-04-15T10:00:00Z'))).toEqual({
      start: '2026-04-13',
      end: '2026-04-19',
    });
  });

  it('treats sunday as the last day of the same week', () => {
    expect(getBusinessBookingsPeriodBounds('week', new Date('2026-04-19T10:00:00Z'))).toEqual({
      start: '2026-04-13',
      end: '2026-04-19',
    });
  });

  it('returns calendar month bounds', () => {
    expect(getBusinessBookingsPeriodBounds('month', new Date('2026-04-13T10:00:00Z'))).toEqual({
      start: '2026-04-01',
      end: '2026-04-30',
    });
  });
});
