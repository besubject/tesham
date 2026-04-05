import { Request, Response, NextFunction } from 'express';
import { bookingService } from '../services/booking.service';

export async function getSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.params.id as string;
    const q = req.query as unknown as { staff_id?: string; date?: string };

    const slots = await bookingService.getSlots(businessId, q.staff_id, q.date);
    res.json({ slots });
  } catch (err) {
    next(err);
  }
}

export async function createBooking(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }
    const { slot_id, service_id } = req.body as { slot_id: string; service_id: string };

    const booking = await bookingService.createBooking({
      user_id: req.user.id,
      slot_id,
      service_id,
    });

    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
}

export async function getMyBookings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    const bookings = await bookingService.getMyBookings(req.user.id);
    res.json({ bookings });
  } catch (err) {
    next(err);
  }
}

export async function cancelBooking(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }
    const bookingId = req.params.id as string;

    const result = await bookingService.cancelBooking(req.user.id, bookingId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
