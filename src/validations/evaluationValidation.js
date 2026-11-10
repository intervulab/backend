// File: src/validations/evaluationValidation.js
import { z } from 'zod';

export const generateReportSchema = z.object({
  overallScore: z.number().min(0).max(100).optional(),
  technicalScore: z.number().min(0).max(100).optional(),
  systemDesignScore: z.number().min(0).max(100).optional(),
  behavioralScore: z.number().min(0).max(100).optional(),
  strengths: z.array(z.string()).optional(),
  improvements: z.array(z.string()).optional(),
  summary: z.string().optional(),
});