// File: src/controllers/answerController.js
import prisma from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import * as agentClient from '../services/agentClient.js';
import * as mlClient from '../services/mlClient.js';

function mapAudioMetricsToPrisma(metrics, { durationSeconds, transcriptText } = {}) {
  if (!metrics) return null;
  const wordCount = (transcriptText || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const pace =
    metrics.averageWPM ??
    metrics.speechPaceWpm ??
    (wordCount > 0 && durationSeconds > 0 ? (wordCount / durationSeconds) * 60 : 0);
  return {
    speechPaceWpm: pace,
    fillerWordsCount: metrics.fillerWordCount ?? metrics.fillerWordsCount ?? 0,
    hesitationCount: metrics.hesitationCount ?? 0,
    clarityScore: metrics.clarityScore ?? 0,
    rawMetricsJson: {
      ...metrics,
      averageWPM: pace,
      durationSeconds: durationSeconds ?? null,
      transcriptWordEstimate: wordCount,
      transcriptText: transcriptText || null,
    },
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
    const audioFileUrl = req.file ? `/uploads/${req.file.filename}` : null;

    let effectiveTranscript = (transcriptText || '').trim();
    let audioMetrics = null;

    if (effectiveTranscript) {
      try {
        await mlClient.appendTranscript(sessionId, effectiveTranscript, true);
      } catch (mlErr) {
        console.warn('[integration] ML transcript segment failed:', mlErr.message);
      }
    }

    if (req.file?.path) {
      try {
        const analysis = await mlClient.analyzeAudioFile(
          sessionId,
          req.file.path,
          effectiveTranscript || undefined,
          req.file.originalname,
          durationSeconds != null ? parseFloat(durationSeconds) : undefined,
        );
        audioMetrics = analysis?.audio_metrics;
        if (!effectiveTranscript && analysis?.audio_transcript?.trim()) {
          effectiveTranscript = analysis.audio_transcript.trim();
        }
      } catch (mlErr) {
        console.warn('[integration] ML analyze-file failed:', mlErr.message);
      }
    }

    if (!audioMetrics && effectiveTranscript) {
      try {
        const finalized = await mlClient.finalizeSession(sessionId);
        audioMetrics = finalized?.audio_metrics;
      } catch (mlErr) {
        console.warn('[integration] ML finalize fallback failed:', mlErr.message);
      }
    }

    const envelope = await mlClient.getEnvelope(sessionId);
    if (!effectiveTranscript && envelope?.audio_transcript?.trim()) {
      effectiveTranscript = envelope.audio_transcript.trim();
    }

    const durationLabel =
      durationSeconds != null && !Number.isNaN(parseFloat(durationSeconds))
        ? `${Math.round(parseFloat(durationSeconds))}s`
        : null;
    if (!effectiveTranscript && req.file) {
      effectiveTranscript = durationLabel
        ? `Voice answer recorded (${durationLabel})`
        : 'Voice answer recorded';
    }

    const answerText = effectiveTranscript || '(spoken answer — see transcript)';

    let agentResponse = null;
    const agentQuestionId = question.agentQuestionId || question.id;

    try {
      agentResponse = await agentClient.submitAnswer({
        session_id: sessionId,
        question_id: agentQuestionId,
        candidate_answer: answerText,
        audio_transcript: envelope?.audio_transcript || effectiveTranscript || null,
      });

      await prisma.agentInteraction.create({
        data: {
          interviewSessionId: sessionId,
          agentName: 'orchestrator',
          actionType: 'answer_evaluated',
          payload: agentResponse,
        },
      });
    } catch (agentErr) {
      console.warn('[integration] Agent answer failed:', agentErr.message);
    }

    if (!agentResponse?.evaluation && effectiveTranscript.length > 2) {
      try {
        const rubric = await mlClient.gradeRubric({
          session_id: sessionId,
          question_id: question.id,
          question_text: question.questionText,
          answer_text: effectiveTranscript,
        });
        agentResponse = {
          ...(agentResponse || {}),
          evaluation: {
            score: Math.min(10, Math.max(0, (rubric.overall_score ?? 70) / 10)),
            feedback: rubric.summary || 'Answer graded via ML rubric.',
            follow_up_question: null,
          },
        };
      } catch (rubricErr) {
        console.warn('[integration] ML rubric fallback failed:', rubricErr.message);
      }
    }

    const audioAnalysisData = mapAudioMetricsToPrisma(audioMetrics, {
      durationSeconds: durationSeconds ? parseFloat(durationSeconds) : undefined,
      transcriptText: effectiveTranscript,
    });

    const candidateAnswer = await prisma.candidateAnswer.upsert({
      where: { interviewQuestionId: questionId },
      update: {
        transcriptText: effectiveTranscript || null,
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
        transcriptText: effectiveTranscript || null,
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

    if (!agentResponse?.session_complete) {
      const unanswered = await prisma.interviewQuestion.count({
        where: { interviewSessionId: sessionId, answer: null },
      });
      if (unanswered === 0) {
        agentResponse = { ...(agentResponse || {}), session_complete: true };
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
