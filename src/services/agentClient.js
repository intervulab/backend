import axios from 'axios';
import { env } from '../config/env.js';

const client = axios.create({
  baseURL: env.AGENT_SERVICE_URL,
  timeout: 120_000,
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-Service-Key': env.PYTHON_SERVICE_API_KEY,
  },
});

function wrapError(err, action) {
  const detail = err.response?.data?.detail || err.message;
  const error = new Error(`Agent service ${action} failed: ${detail}`);
  error.status = err.response?.status || 502;
  throw error;
}

export async function startInterview(payload) {
  try {
    const { data } = await client.post('/interview/start', payload);
    return data;
  } catch (err) {
    wrapError(err, 'start');
  }
}

export async function submitAnswer(payload) {
  try {
    const { data } = await client.post('/interview/answer', payload);
    return data;
  } catch (err) {
    wrapError(err, 'answer');
  }
}

export async function getSessionSummary(sessionId) {
  try {
    const { data } = await client.get(`/interview/summary/${sessionId}`);
    return data;
  } catch (err) {
    wrapError(err, 'summary');
  }
}

export async function analyseCanvas(sessionId, canvasJson) {
  try {
    const { data } = await client.post('/canvas/analyse', {
      session_id: sessionId,
      canvas_json: canvasJson,
    });
    return data;
  } catch (err) {
    wrapError(err, 'canvas');
  }
}
