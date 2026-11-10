// File: src/routes/resumeRoutes.js
import { Router } from 'express';
import { handleResumeUpload, getCandidateResumes } from '../controllers/resumeController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { uploadResume } from '../middleware/upload.js';

const router = Router();

router.use(authenticateToken);

router.post('/upload', uploadResume.single('resume'), handleResumeUpload);
router.get('/', getCandidateResumes);

export default router;