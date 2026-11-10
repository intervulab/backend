// File: src/routes/sessionRoutes.js
import { Router } from 'express';
import {
  createInterviewSession,
  getCandidateSessions,
  getSessionById,
  updateSessionStatus,
} from '../controllers/sessionController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { createSessionSchema, updateSessionStatusSchema } from '../validations/sessionValidation.js';

const router = Router();

router.use(authenticateToken);

router.post('/', validate(createSessionSchema), createInterviewSession);
router.get('/', getCandidateSessions);
router.get('/:sessionId', getSessionById);
router.patch('/:sessionId/status', validate(updateSessionStatusSchema), updateSessionStatus);

export default router;