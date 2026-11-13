import fs from 'fs/promises';
import prisma from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import * as mlClient from '../services/mlClient.js';

async function assertSessionAccess(sessionId, userId) {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: { candidate: true },
  });
  if (!session) {
    throw new ApiError(404, 'Interview session not found');
  }
  if (session.candidate?.userId !== userId) {
    throw new ApiError(403, 'Not allowed to access this session');
  }
  return session;
}

/** Live caption fallback: transcribe in-progress recording via C5 Whisper. */
export async function liveTranscribeSnippet(req, res, next) {
  try {
    const { sessionId } = req.params;
    await assertSessionAccess(sessionId, req.user.id);

    if (!req.file) {
      throw new ApiError(400, 'Audio file is required');
    }

    let text = '';
    try {
      const result = await mlClient.transcribeSnippet(req.file.path, req.file.originalname || 'snippet.webm');
      text = (result?.text || '').trim();
    } finally {
      await fs.unlink(req.file.path).catch(() => {});
    }

    res.status(200).json({
      success: true,
      data: { text, sessionId },
    });
  } catch (error) {
    next(error);
  }
}
