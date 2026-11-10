// File: src/routes/evaluationRoutes.js
import { Router } from 'express';
import { generateSessionReport, getSessionReport } from '../controllers/evaluationController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { generateReportSchema } from '../validations/evaluationValidation.js';

const router = Router();

router.use(authenticateToken);

// Generate or recalculate session report
router.post('/sessions/:sessionId/report', validate(generateReportSchema), generateSessionReport);

// Get generated session report
router.get('/sessions/:sessionId/report', getSessionReport);

export default router;