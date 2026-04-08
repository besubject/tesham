import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { generateUploadUrl } from '../controllers/upload.controller';

const router = Router();

// GET /upload-url — generate signed PUT URL for photo upload
// Query params: type (photo|portfolio), fileName
// Requires auth + businessId (via RBAC middleware)
router.get('/upload-url', requireAuth, generateUploadUrl);

export default router;
