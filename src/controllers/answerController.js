// File: src/controllers/answerController.js
import prisma from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import * as agentClient from '../services/agentClient.js';
import * as mlClient from '../services/mlClient.js';

function mapAudioMetricsToPrisma(metrics) {
  if (!metrics) return null;
  return {
    speechPaceWpm: metrics.averageWPM ?? metrics.speechPaceWpm ?? 0,
    fillerWordsCount: metrics.fillerWordCount ?? metrics.fillerWordsCount ?? 0,
    hesitationCount: metrics.hesitationCount ?? 0,
    clarityScore: metrics.clarityScore ?? 0,
    rawMetricsJson: metrics,
  };
}

export async function submitCandidateAnswer(req, res, next) {
  try {
    const { questionId } = req.params;
    const { transcriptText, durationSeconds } = req.body;

    const question = await prisma.interviewQuestion.findUnique({
      where: { id: questionId },
      include: { interviewSession: true, answer: true },
    });

    if (!question) {
      throw new ApiError(404, 'Interview question not found');
    }

    const sessionId = question.interviewSessionId;
    const answerText = (transcriptText || '').trim() || '(spoken answer — see transcript)';
    const audioFileUrl = req.file ? `/uploads/${req.file.filename}` : null;

    let audioMetrics = null;

    if (req.file?.path) {
      const analysis = await mlClient.analyzeAudioFile(
        sessionId,
        req.file.path,
        transcriptText,
        req.file.originalname,
      );
      audioMetrics = analysis?.audio_metrics;
    } else if (transcriptText?.trim()) {
      await mlClient.appendTranscript(sessionId, transcriptText);
    }

    const envelope = await mlClient.getEnvelope(sessionId);

    let agentResponse = null;
    if (question.agentQuestionId) {
      agentResponse = await agentClient.submitAnswer({
        session_id: sessionId,
        question_id: question.agentQuestionId,
        candidate_answer: answerText,
        audio_transcript: envelope?.audio_transcript || transcriptText || null,
      });

      await prisma.agentInteraction.create({
        data: {
          interviewSessionId: sessionId,
          agentName: 'orchestrator',
          actionType: 'answer_evaluated',
          payload: agentResponse,
        },
      });
    }

    const audioAnalysisData = mapAudioMetricsToPrisma(audioMetrics);

    const candidateAnswer = await prisma.candidateAnswer.upsert({
      where: { interviewQuestionId: questionId },
      update: {
        transcriptText: transcriptText || null,
        audioFileUrl: audioFileUrl || undefined,
        durationSeconds: durationSeconds ? parseFloat(durationSeconds) : undefined,
        submittedAt: new Date(),
        ...(audioAnalysisData
          ? {
              audioAnalysis: {
                upsert: {
                  create: audioAnalysisData,
                  update: audioAnalysisData,
                },
              },
            }
          : {}),
      },
      create: {
        interviewQuestionId: questionId,
        transcriptText: transcriptText || null,
        audioFileUrl: audioFileUrl || null,
        durationSeconds: durationSeconds ? parseFloat(durationSeconds) : null,
        ...(audioAnalysisData
          ? {
              audioAnalysis: { create: audioAnalysisData },
            }
          : {
              audioAnalysis: {
                create: {
                  speechPaceWpm: 0,
                  fillerWordsCount: 0,
                  hesitationCount: 0,
                  clarityScore: 0,
                  rawMetricsJson: {},
                },
              },
            }),
      },
      include: {
        audioAnalysis: true,
        evaluation: true,
      },
    });

    if (agentResponse?.evaluation) {
      const ev = agentResponse.evaluation;
      const technicalScore = (ev.score ?? 0) * 10;
      await prisma.interviewEvaluation.upsert({
        where: { candidateAnswerId: candidateAnswer.id },
        create: {
          candidateAnswerId: candidateAnswer.id,
          technicalScore,
          clarityScore: audioMetrics?.clarityScore ?? technicalScore,
          feedbackText: ev.feedback || 'No feedback returned.',
          strengths: [],
          improvements: ev.follow_up_question ? [ev.follow_up_question] : [],
        },
        update: {
          technicalScore,
          clarityScore: audioMetrics?.clarityScore ?? technicalScore,
          feedbackText: ev.feedback || 'No feedback returned.',
          improvements: ev.follow_up_question ? [ev.follow_up_question] : [],
        },
      });
    }

    if (agentResponse?.next_question && !agentResponse?.session_complete) {
      const nq = agentResponse.next_question;
      const existing = await prisma.interviewQuestion.findFirst({
        where: { interviewSessionId: sessionId, agentQuestionId: nq.question_id },
      });
      if (!existing) {
        const maxOrder = await prisma.interviewQuestion.aggregate({
          where: { interviewSessionId: sessionId },
          _max: { orderIndex: true },
        });
        await prisma.interviewQuestion.create({
          data: {
            interviewSessionId: sessionId,
            agentQuestionId: nq.question_id,
            questionText: nq.text,
            category: 'TECHNICAL_CONCEPT',
            difficulty: 'MEDIUM',
            orderIndex: (maxOrder._max.orderIndex || 0) + 1,
          },
        });
      }
    }

    if (agentResponse?.session_complete) {
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }

    const refreshed = await prisma.candidateAnswer.findUnique({
      where: { id: candidateAnswer.id },
      include: { audioAnalysis: true, evaluation: true },
    });

    res.status(201).json({
      success: true,
      message: 'Answer submitted successfully',
      data: {
        answer: refreshed,
        agent: agentResponse,
        realTimeMetrics: envelope?.real_time_metrics,
      },
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

    let aiFeedback = null;
    try {
      aiFeedback = await agentClient.analyseCanvas(sessionId, canvasDataJson);
      await prisma.agentInteraction.create({
        data: {
          interviewSessionId: sessionId,
          agentName: 'canvas_agent',
          actionType: 'canvas_analysed',
          payload: aiFeedback,
        },
      });
    } catch (canvasErr) {
      console.warn('[integration] Canvas analysis failed:', canvasErr.message);
      aiFeedback = {
        overall_assessment: 'Canvas saved; AI analysis unavailable.',
        flaws: [],
        suggestions: [],
      };
    }

    const submission = await prisma.systemDesignSubmission.upsert({
      where: { interviewSessionId: sessionId },
      update: {
        canvasDataJson,
        aiFeedback,
        submittedAt: new Date(),
      },
      create: {
        interviewSessionId: sessionId,
        canvasDataJson,
        aiFeedback,
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
