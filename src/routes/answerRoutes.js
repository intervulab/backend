// File: src/routes/answerRoutes.js
import { Router } from 'express';
import { submitCandidateAnswer, submitSystemDesignCanvas } from '../controllers/answerController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { uploadAudio } from '../middleware/audioUpload.js';
import { validate } from '../middleware/validate.js';
import { systemDesignSubmissionSchema } from '../validations/answerValidation.js';

const router = Router();

router.use(authenticateToken);

// Submit audio answer or text transcript for a question
router.post('/questions/:questionId/answer', uploadAudio.single('audio'), submitCandidateAnswer);

// Submit system design canvas diagram
router.post('/sessions/:sessionId/system-design', validate(systemDesignSubmissionSchema), submitSystemDesignCanvas);

export default router;