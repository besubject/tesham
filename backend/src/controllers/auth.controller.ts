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

    if (result.requiresEmailVerification) {
      // User has a verified email and has been inactive for 12+ months.
      // We need to confirm it's the original owner before issuing tokens.
      res.json({ requiresEmailVerification: true });
      return;
    }

    res.json({ accessToken: result.tokens.accessToken, refreshToken: result.tokens.refreshToken, user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function verifyEmailLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, code } = req.body as { phone: string; code: string };
    const { tokens, user } = await authService.verifyEmailLoginCode(phone, code);
    res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user });
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
