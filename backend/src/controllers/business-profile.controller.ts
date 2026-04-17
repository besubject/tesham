import { Request, Response, NextFunction } from 'express';
import { businessProfileService } from '../services/business-profile.service';
import type { StaffRole } from '../db/types';

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getBusinessProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Business access required' } });
      return;
    }

    const profile = await businessProfileService.getProfile(req.user.businessId);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

export async function updateBusinessProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Business access required' } });
      return;
    }

    const profile = await businessProfileService.updateProfile({
      userId: req.user.id,
      businessId: req.user.businessId,
      update: req.body as Record<string, unknown>,
    });

    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export async function getBusinessStaff(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Business access required' } });
      return;
    }

    const staff = await businessProfileService.getStaff(req.user.businessId);
    res.json({ staff });
  } catch (err) {
    next(err);
  }
}

export async function getCurrentBusinessStaff(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Business access required' } });
      return;
    }

    const staff = await businessProfileService.getCurrentStaff(req.user.id, req.user.businessId);
    res.json({ staff });
  } catch (err) {
    next(err);
  }
}

export async function addBusinessStaff(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Business access required' } });
      return;
    }

    const { name, phone, role } = req.body as { name: string; phone: string; role: StaffRole };

    const member = await businessProfileService.addStaff({
      userId: req.user.id,
      businessId: req.user.businessId,
      name,
      phone,
      role,
    });

    res.status(201).json({ staff: member });
  } catch (err) {
    next(err);
  }
}

export async function deleteBusinessStaff(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Business access required' } });
      return;
    }

    await businessProfileService.deleteStaff({
      userId: req.user.id,
      businessId: req.user.businessId,
      staffId: req.params.id as string,
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function getBusinessServices(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Business access required' } });
      return;
    }

    const services = await businessProfileService.getServices(req.user.businessId);
    res.json({ services });
  } catch (err) {
    next(err);
  }
}

export async function createBusinessService(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Business access required' } });
      return;
    }

    const { name, price, duration_minutes } = req.body as {
      name: string;
      price: number;
      duration_minutes: number;
    };

    const service = await businessProfileService.createService({
      userId: req.user.id,
      businessId: req.user.businessId,
      name,
      price,
      duration_minutes,
    });

    res.status(201).json({ service });
  } catch (err) {
    next(err);
  }
}

export async function updateBusinessService(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Business access required' } });
      return;
    }

    const { name, price, duration_minutes, is_active } = req.body as {
      name?: string;
      price?: number;
      duration_minutes?: number;
      is_active?: boolean;
    };

    const service = await businessProfileService.updateService({
      userId: req.user.id,
      businessId: req.user.businessId,
      serviceId: req.params.id as string,
      name,
      price,
      duration_minutes,
      is_active,
    });

    res.json({ service });
  } catch (err) {
    next(err);
  }
}

export async function deleteBusinessService(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Business access required' } });
      return;
    }

    await businessProfileService.deleteService({
      userId: req.user.id,
      businessId: req.user.businessId,
      serviceId: req.params.id as string,
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
