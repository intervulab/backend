// File: src/controllers/sessionController.js
import prisma from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import * as agentClient from '../services/agentClient.js';

const DEFAULT_QUESTIONS = [
  {
    category: 'TECHNICAL_CONCEPT',
    difficulty: 'MEDIUM',
    questionText:
      'Explain the core principles of asynchronous I/O and how event loops manage non-blocking execution.',
  },
];

export async function createInterviewSession(req, res, next) {
  try {
    const { title, targetRole, resumeId } = req.body;

    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: { userId: req.user.id },
      include: { user: true },
    });

    if (!candidateProfile) {
      throw new ApiError(404, 'Candidate profile not found');
    }

    let resume = null;
    if (resumeId) {
      resume = await prisma.resume.findFirst({
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
      },
    });

    const candidateName = `${candidateProfile.firstName} ${candidateProfile.lastName}`.trim();
    const resumeText = resume?.extractedText || '';

    let questionsToStore = [];
    let agentPayload = null;

    try {
      agentPayload = await agentClient.startInterview({
        session_id: session.id,
        candidate_name: candidateName || candidateProfile.user.email,
        job_role: targetRole,
        resume_text: resumeText,
        round_type: 'technical',
        tech_stack: [],
      });

      questionsToStore = (agentPayload.questions || []).map((q, index) => ({
        interviewSessionId: session.id,
        agentQuestionId: q.question_id,
        questionText: q.text,
        category: 'TECHNICAL_CONCEPT',
        difficulty: 'MEDIUM',
        orderIndex: index + 1,
      }));

      await prisma.agentInteraction.create({
        data: {
          interviewSessionId: session.id,
          agentName: 'orchestrator',
          actionType: 'interview_started',
          payload: agentPayload,
        },
      });
    } catch (agentErr) {
      console.warn('[integration] Agent start failed, using fallback questions:', agentErr.message);
      questionsToStore = DEFAULT_QUESTIONS.map((q, index) => ({
        interviewSessionId: session.id,
        questionText: q.questionText,
        category: q.category,
        difficulty: q.difficulty,
        orderIndex: index + 1,
      }));
    }

    await prisma.interviewQuestion.createMany({ data: questionsToStore });

    const fullSession = await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
      include: {
        questions: { orderBy: { orderIndex: 'asc' } },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Interview session created successfully',
      data: {
        ...fullSession,
        agentSessionId: session.id,
        debateLog: agentPayload?.debate_log || [],
      },
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
        questions: { select: { id: true, questionText: true, orderIndex: true } },
        report: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, data: sessions });
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
          include: { answer: { include: { audioAnalysis: true, evaluation: true } } },
        },
        systemDesignSubmission: true,
        report: true,
      },
    });

    if (!session) {
      throw new ApiError(404, 'Interview session not found');
    }

    res.status(200).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
}

export async function updateSessionStatus(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { status } = req.body;

    const updatedSession = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { status },
    });

    res.status(200).json({
      success: true,
      message: 'Session status updated',
      data: updatedSession,
    });
  } catch (error) {
    next(error);
  }
}
