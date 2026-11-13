import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { env } from '../config/env.js';

const client = axios.create({
  baseURL: env.ML_SERVICE_URL,
  timeout: 60_000,
  headers: {
    'X-Internal-Service-Key': env.PYTHON_SERVICE_API_KEY,
  },
});

function wrapError(err, action) {
  const detail = err.response?.data?.detail || err.message;
  const error = new Error(`ML service ${action} failed: ${detail}`);
  error.status = err.response?.status || 502;
  throw error;
}

export async function resetAudioCounters(sessionId) {
  try {
    await client.post(`/audio/session/${sessionId}/reset-counters`);
  } catch (err) {
    wrapError(err, 'reset-counters');
  }
}

export async function processAudioChunk(payload) {
  try {
    const { data } = await client.post('/audio/chunk', payload);
    return data;
  } catch (err) {
    wrapError(err, 'chunk');
  }
}

export async function appendTranscript(sessionId, text, isFinal = true) {
  if (!text?.trim()) return null;
  try {
    const { data } = await client.post('/transcript/segment', {
      session_id: sessionId,
      text: text.trim(),
      is_final: isFinal,
      confidence: 1,
      speaker: 'candidate',
    });
    return data;
  } catch (err) {
    wrapError(err, 'transcript');
  }
}

export async function transcribeSnippet(filePath, originalName) {
  try {
    const form = new FormData();
    form.append('audio', fs.createReadStream(filePath), {
      filename: originalName || 'snippet.webm',
    });
    const { data } = await axios.post(`${env.ML_SERVICE_URL}/audio/transcribe-snippet`, form, {
      headers: form.getHeaders(),
      timeout: 90_000,
    });
    return data;
  } catch (err) {
    wrapError(err, 'transcribe-snippet');
  }
}

export async function analyzeAudioFile(
  sessionId,
  filePath,
  transcriptText,
  originalName,
  durationSeconds,
) {
  try {
    const form = new FormData();
    form.append('session_id', sessionId);
    if (transcriptText?.trim()) {
      form.append('transcript_text', transcriptText.trim());
    }
    if (durationSeconds != null && !Number.isNaN(Number(durationSeconds))) {
      form.append('duration_seconds', String(durationSeconds));
    }
    form.append('audio', fs.createReadStream(filePath), {
      filename: originalName || 'answer.wav',
    });
    const { data } = await axios.post(`${env.ML_SERVICE_URL}/audio/analyze-file`, form, {
      headers: form.getHeaders(),
      timeout: 120_000,
    });
    return data;
  } catch (err) {
    wrapError(err, 'analyze-file');
  }
}

export async function getEnvelope(sessionId) {
  try {
    const { data } = await client.get(`/sessions/${sessionId}/envelope`);
    return data;
  } catch (err) {
    wrapError(err, 'envelope');
  }
}

export async function finalizeSession(sessionId) {
  try {
    const { data } = await client.post('/audio/finalize', { session_id: sessionId });
    return data;
  } catch (err) {
    wrapError(err, 'finalize');
  }
}

export async function gradeRubric(payload) {
  try {
    const { data } = await client.post('/rubric/grade', payload);
    return data;
  } catch (err) {
    wrapError(err, 'rubric');
  }
}
