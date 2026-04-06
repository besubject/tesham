import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import { validateEvent, postEvent } from '../controllers/event.controller';

const router = Router();

// POST /events — client-side event tracking (auth optional)
router.post('/', optionalAuth, validateEvent, postEvent);

export default router;
