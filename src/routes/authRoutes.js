// File: src/routes/authRoutes.js
import { Router } from 'express';
import { registerCandidate, loginUser, getProfile } from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validations/authValidation.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', validate(registerSchema), registerCandidate);
router.post('/login', validate(loginSchema), loginUser);
router.get('/me', authenticateToken, getProfile);

export default router;