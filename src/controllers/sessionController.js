// File: src/controllers/sessionController.js
import prisma from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';

// Default question templates generated based on target role
const DEFAULT_QUESTIONS = [
  {
    category: 'TECHNICAL_CONCEPT',
    difficulty: 'MEDIUM',
    questionText: 'Explain the core principles of asynchronous I/O and how event loops manage non-blocking execution.',
  },
  {
    category: 'SYSTEM_DESIGN',
    difficulty: 'HARD',
    questionText: 'Design a scalable multi-tenant architecture for handling real-time high-throughput websocket connections.',
  },
  {
    category: 'CODING_LOGIC',
    difficulty: 'MEDIUM',
    questionText: 'How would you optimize database query indexing to handle millions of read requests per minute with low latency?',
  },
  {
    category: 'BEHAVIORAL',
    difficulty: 'EASY',
    questionText: 'Describe a situation where you had to make a critical architectural tradeoff under tight project deadlines.',
  },
  {
    category: 'DEVI_ADVOCATE',
    difficulty: 'HARD',
    questionText: 'Why would microservices be a terrible choice for a early-stage startup product compared to a clean monolith?',
  },
];

export async function createInterviewSession(req, res, next) {
  try {
    const { title, targetRole, resumeId } = req.body;

    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!candidateProfile) {
      throw new ApiError(404, 'Candidate profile not found');
    }

    if (resumeId) {
      const resume = await prisma.resume.findFirst({
        where: { id: resumeId, candidateId: candidateProfile.id },
      });
      if (!resume) {
        throw new ApiError(404, 'Associated resume not found');
      }
    }

    const session = await prisma.interviewSession.create({
      data: {
        candidateId: candidateProfile.id,
        resumeId: resumeId || null,
        title,
        targetRole,
        status: 'SCHEDULED',
        questions: {
          create: DEFAULT_QUESTIONS.map((q, index) => ({
            questionText: q.questionText,
            category: q.category,
            difficulty: q.difficulty,
            orderIndex: index + 1,
          })),
        },
      },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Interview session created successfully',
      data: session,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCandidateSessions(req, res, next) {
  try {
    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!candidateProfile) {
      throw new ApiError(404, 'Candidate profile not found');
    }

    const sessions = await prisma.interviewSession.findMany({
      where: { candidateId: candidateProfile.id },
      include: {
        questions: true,
        report: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSessionById(req, res, next) {
  try {
    const { sessionId } = req.params;

    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
          include: { answer: true },
        },
        systemDesignSubmission: true,
        report: true,
      },
    });

    if (!session) {
      throw new ApiError(404, 'Interview session not found');
    }

    res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSessionStatus(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { status } = req.body;

    const updateData = { status };
    if (status === 'IN_PROGRESS') {
      updateData.startedAt = new Date();
    } else if (status === 'COMPLETED' || status === 'CANCELLED') {
      updateData.completedAt = new Date();
    }

    const updatedSession = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      message: `Session status updated to ${status}`,
      data: updatedSession,
    });
  } catch (error) {
    next(error);
  }
}