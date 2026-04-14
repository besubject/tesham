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

    const q = req.query as {
      staff_id?: string;
      date?: string;
      status?: BookingStatus;
      period?: 'today' | 'week' | 'month';
      limit?: string;
      offset?: string;
    };

    const result = await businessBookingService.getBusinessBookings({
      userId: req.user.id,
      businessId: req.user.businessId,
      staffId: q.staff_id,
      date: q.date,
      status: q.status,
      period: q.period,
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createWalkInBooking(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Business access required' } });
      return;
    }

    const body = req.body as {
      staff_id: string;
      service_id: string;
      client_name?: string;
      client_phone?: string;
      time?: string;
    };

    const booking = await businessBookingService.createWalkInBooking({
      userId: req.user.id,
      businessId: req.user.businessId,
      staffId: body.staff_id,
      serviceId: body.service_id,
      clientName: body.client_name,
      clientPhone: body.client_phone,
      time: body.time,
    });

    res.status(201).json({ booking });
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
