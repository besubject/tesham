import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';

export async function sendCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone } = req.body as { phone: string };
    await authService.sendCode(phone);
    res.json({ message: 'Code sent' });
  } catch (err) {
    next(err);
  }
}

export async function verifyCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, code } = req.body as { phone: string; code: string };
    const result = await authService.verifyCode(phone, code);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    const tokens = await authService.refresh(refreshToken);
    res.json({ tokens });
  } catch (err) {
    next(err);
  }
}
