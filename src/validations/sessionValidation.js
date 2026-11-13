// File: src/validations/sessionValidation.js
import { z } from 'zod';

export const createSessionSchema = z.object({
  title: z.string().min(1, 'Session title is required'),
  targetRole: z.string().min(1, 'Target role is required'),
  resumeId: z.string().uuid().optional(),
  questionCount: z.coerce.number().int().min(1).max(15).optional().default(3),
});

export const updateSessionStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});