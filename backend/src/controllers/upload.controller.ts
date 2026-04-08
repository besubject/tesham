import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { s3Service } from '../services/s3.service';
import { AppError } from '../middleware/error';

const uploadUrlSchema = z
  .object({
    type: z.enum(['photo', 'portfolio']),
    fileName: z.string().min(1).max(255),
  })
  .strict();

export async function generateUploadUrl(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.businessId) {
      throw new AppError(403, 'Business access required', 'FORBIDDEN');
    }

    const { type, fileName } = uploadUrlSchema.parse(req.query);

    const uploadUrl = await s3Service.generateUploadUrl(type, req.user.businessId, fileName);

    res.json({ uploadUrl });
  } catch (err) {
    next(err);
  }
}
