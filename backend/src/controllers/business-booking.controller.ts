import { Request, Response, NextFunction } from 'express';
import { businessBookingService } from '../services/business-booking.service';
import type { BookingStatus } from '../db/types';

export async function createBusinessSlots(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Business access required' } });
      return;
    }

    const { staff_id, date, times } = req.body as {
      staff_id: string;
      date: string;
      times: string[];
    };

    const slots = await businessBookingService.createSlots({
      userId: req.user.id,
      businessId: req.user.businessId,
      staffId: staff_id,
      date,
      times,
    });

    res.status(201).json({ slots });
  } catch (err) {
    next(err);
  }
}

export async function deleteBusinessSlot(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Business access required' } });
      return;
    }

    await businessBookingService.deleteSlot({
      userId: req.user.id,
      businessId: req.user.businessId,
      slotId: req.params.id as string,
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getBusinessBookings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Business access required' } });
      return;
    }

    const q = req.query as { staff_id?: string; date?: string };

    const bookings = await businessBookingService.getBusinessBookings({
      userId: req.user.id,
      businessId: req.user.businessId,
      staffId: q.staff_id,
      date: q.date,
    });

    res.json({ bookings });
  } catch (err) {
    next(err);
  }
}

export async function updateBusinessBookingStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Business access required' } });
      return;
    }

    const { status } = req.body as { status: BookingStatus };

    const booking = await businessBookingService.updateBookingStatus({
      userId: req.user.id,
      businessId: req.user.businessId,
      bookingId: req.params.id as string,
      status,
    });

    res.json({ booking });
  } catch (err) {
    next(err);
  }
}
