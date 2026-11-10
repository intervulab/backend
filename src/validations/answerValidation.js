// File: src/validations/answerValidation.js
import { z } from 'zod';

export const systemDesignSubmissionSchema = z.object({
  canvasDataJson: z.record(z.any(), {
    required_error: 'Canvas JSON data is required',
  }),
});