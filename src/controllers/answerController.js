// File: src/controllers/answerController.js
import prisma from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';

export async function submitCandidateAnswer(req, res, next) {
  try {
    const { questionId } = req.params;
    const { transcriptText, durationSeconds } = req.body;

    const question = await prisma.interviewQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new ApiError(404, 'Interview question not found');
    }

    const audioFileUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const candidateAnswer = await prisma.candidateAnswer.upsert({
      where: { interviewQuestionId: questionId },
      update: {
        transcriptText: transcriptText || undefined,
        audioFileUrl: audioFileUrl || undefined,
        durationSeconds: durationSeconds ? parseFloat(durationSeconds) : undefined,
        submittedAt: new Date(),
      },
      create: {
        interviewQuestionId: questionId,
        transcriptText: transcriptText || null,
        audioFileUrl: audioFileUrl || null,
        durationSeconds: durationSeconds ? parseFloat(durationSeconds) : null,
        audioAnalysis: {
          create: {
            speechPaceWpm: 140.5,
            fillerWordsCount: 3,
            hesitationCount: 2,
            clarityScore: 8.5,
            rawMetricsJson: { tone: 'Confident', articulation: 'Clear' },
          },
        },
      },
      include: {
        audioAnalysis: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Answer submitted successfully',
      data: candidateAnswer,
    });
  } catch (error) {
    next(error);
  }
}

export async function submitSystemDesignCanvas(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { canvasDataJson } = req.body;

    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new ApiError(404, 'Interview session not found');
    }

    const submission = await prisma.systemDesignSubmission.upsert({
      where: { interviewSessionId: sessionId },
      update: {
        canvasDataJson,
        submittedAt: new Date(),
      },
      create: {
        interviewSessionId: sessionId,
        canvasDataJson,
        aiFeedback: {
          scenariosEvaluated: ['Scalability', 'Fault Tolerance', 'Load Balancing'],
          score: 8.8,
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'System Design Canvas submitted successfully',
      data: submission,
    });
  } catch (error) {
    next(error);
  }
}