// File: src/controllers/evaluationController.js
import prisma from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import * as agentClient from '../services/agentClient.js';
import * as mlClient from '../services/mlClient.js';
import { aggregateAudioAnalyses } from '../utils/aggregateAudioMetrics.js';

export async function generateSessionReport(req, res, next) {
  try {
    const { sessionId } = req.params;

    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        questions: {
          include: { answer: { include: { evaluation: true, audioAnalysis: true } } },
        },
        systemDesignSubmission: true,
      },
    });

    if (!session) {
      throw new ApiError(404, 'Interview session not found');
    }

    let agentSummary = null;
    let mlFinalize = null;

    try {
      agentSummary = await agentClient.getSessionSummary(sessionId);
    } catch (err) {
      console.warn('[integration] Agent summary unavailable:', err.message);
    }

    try {
      mlFinalize = await mlClient.finalizeSession(sessionId);
    } catch (err) {
      console.warn('[integration] ML finalize unavailable:', err.message);
    }

    const dbAudioRows = session.questions
      .map((q) => q.answer?.audioAnalysis)
      .filter(Boolean);
    const aggregatedFromDb = aggregateAudioAnalyses(dbAudioRows);
    if (aggregatedFromDb) {
      mlFinalize = {
        ...(mlFinalize || {}),
        audio_metrics: aggregatedFromDb,
        audio_transcript: mlFinalize?.audio_transcript || '',
      };
    }

    const evalScores = session.questions
      .map((q) => q.answer?.evaluation?.technicalScore)
      .filter((s) => typeof s === 'number');
    const avgFromDb =
      evalScores.length > 0
        ? evalScores.reduce((a, b) => a + b, 0) / evalScores.length
        : null;

    const overallScore =
      agentSummary?.overall_score != null
        ? Number(agentSummary.overall_score) * 10
        : avgFromDb ?? 75;

    const technicalSummary =
      agentSummary?.hr_assessment ||
      `Technical performance for ${session.targetRole} role.`;

    const behavioralSummary =
      mlFinalize?.audio_metrics != null
        ? `Speech: ${mlFinalize.audio_metrics.averageWPM} WPM, ${mlFinalize.audio_metrics.fillerWordCount} fillers, clarity ${mlFinalize.audio_metrics.clarityScore}/100.`
        : 'Communication metrics from audio analytics.';

    const recommendation =
      agentSummary?.hiring_recommendation?.toUpperCase().replace(/ /g, '_') ||
      (overallScore >= 80 ? 'HIRE' : 'NO_HIRE');

    const VOICE_PLACEHOLDER_RE = /^Voice answer recorded(\s*\(\d+s\))?$/i;

    const answerTranscripts = session.questions
      .map((q, index) => {
        const raw = q.answer?.transcriptText?.trim() || null;
        const isPlaceholder = raw ? VOICE_PLACEHOLDER_RE.test(raw) : false;
        return {
          orderIndex: q.orderIndex ?? index + 1,
          questionPreview: (q.questionText || '').slice(0, 120),
          transcriptText: isPlaceholder ? null : raw,
          voiceRecordedSeconds: q.answer?.durationSeconds
            ? Math.round(Number(q.answer.durationSeconds))
            : null,
          transcriptionPending: Boolean(isPlaceholder || (q.answer?.audioFileUrl && !raw)),
        };
      })
      .filter(
        (row) =>
          row.transcriptText ||
          row.transcriptionPending ||
          row.voiceRecordedSeconds != null,
      );

    const detailedFeedback = {
      agentSummary,
      audioMetrics: mlFinalize?.audio_metrics || null,
      answerTranscripts,
      strengths: agentSummary?.strengths || [],
      improvements: agentSummary?.weaknesses || [],
      perQuestion: agentSummary?.per_question_results || [],
      systemDesign: session.systemDesignSubmission?.aiFeedback || null,
    };

    const report = await prisma.interviewReport.upsert({
      where: { interviewSessionId: sessionId },
      update: {
        overallScore,
        technicalSummary,
        behavioralSummary,
        recommendation,
        detailedFeedback,
        generatedAt: new Date(),
      },
      create: {
        interviewSessionId: sessionId,
        overallScore,
        technicalSummary,
        behavioralSummary,
        recommendation,
        detailedFeedback,
      },
    });

    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Evaluation report generated successfully',
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSessionReport(req, res, next) {
  try {
    const { sessionId } = req.params;

    const report = await prisma.interviewReport.findUnique({
      where: { interviewSessionId: sessionId },
      include: {
        interviewSession: {
          include: { candidate: true },
        },
      },
    });

    if (!report) {
      throw new ApiError(404, 'Evaluation report not found for this session');
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}
